const express = require('express');
const router = express.Router();
const https = require('https');
const multer = require('multer');

// 内存存储（不写磁盘）
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// POST /api/asr  multipart: audio file
router.post('/', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '缺少音频文件' });

  try {
    const text = await recognizeSpeech(req.file.buffer, req.file.mimetype);
    res.json({ text });
  } catch (e) {
    console.error('ASR 失败:', e);
    res.status(500).json({ error: '语音识别失败', detail: e.message });
  }
});

// 调用 DashScope Paraformer ASR（文件上传方式）
function recognizeSpeech(buffer, mimetype) {
  return new Promise((resolve, reject) => {
    // 构建 multipart/form-data 手动拼接（Node 内置 https 不支持 FormData）
    const boundary = `----FormBoundary${Date.now()}`;
    const ext = mimetype.includes('webm') ? 'webm' : mimetype.includes('wav') ? 'wav' : 'mp3';

    const header = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="audio.${ext}"\r\n` +
      `Content-Type: ${mimetype}\r\n\r\n`
    );
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([header, buffer, footer]);

    // DashScope Paraformer 实时识别 REST 接口
    const payload = JSON.stringify({
      model: 'paraformer-realtime-v2',
      input: { audio_format: ext },
      parameters: { language_hints: ['zh', 'en'] }
    });

    // Paraformer file-based API
    const formHeader = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="request"\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      payload + `\r\n`
    );
    const fullBody = Buffer.concat([formHeader, header, buffer, footer]);

    const options = {
      hostname: 'dashscope.aliyuncs.com',
      path: '/api/v1/services/audio/asr/transcription',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': fullBody.length
      }
    };

    const req = https.request(options, (apiRes) => {
      let data = '';
      apiRes.on('data', chunk => { data += chunk; });
      apiRes.on('end', () => {
        try {
          const result = JSON.parse(data);
          // Paraformer 返回格式
          const text = result?.output?.results?.[0]?.transcription ||
                       result?.output?.sentence?.[0]?.text ||
                       result?.output?.text || '';
          if (text) {
            resolve(text);
          } else {
            reject(new Error('识别结果为空: ' + JSON.stringify(result)));
          }
        } catch (e) { reject(e); }
      });
    });

    req.on('error', reject);
    req.write(fullBody);
    req.end();
  });
}

module.exports = router;
