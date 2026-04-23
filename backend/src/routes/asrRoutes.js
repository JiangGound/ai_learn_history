const express = require('express');
const router = express.Router();
const https = require('https');
const http = require('http');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// POST /api/asr  multipart: audio file
router.post('/', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '缺少音频文件' });

  try {
    const base64 = req.file.buffer.toString('base64');
    const mime = req.file.mimetype || 'audio/webm';
    // DashScope 支持 data URI 作为 file_url
    const dataUri = `data:${mime};base64,${base64}`;

    // 1. 创建转写任务
    const taskId = await createTask(dataUri);

    // 2. 轮询任务直到完成（最夐30秒）
    const transcriptionUrl = await pollTask(taskId, 30);

    // 3. 获取转写结果
    const text = await fetchTranscription(transcriptionUrl);

    res.json({ text });
  } catch (e) {
    console.error('ASR 失败:', e.message);
    res.status(500).json({ error: '语音识别失败', detail: e.message });
  }
});

// 创建 DashScope ASR 异步任务
function createTask(dataUri) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: 'paraformer-v2',
      input: { file_urls: [dataUri] },
      parameters: { language_hints: ['zh', 'en'] }
    });
    const options = {
      hostname: 'dashscope.aliyuncs.com',
      path: '/api/v1/services/audio/asr/transcription',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY}`,
        'X-DashScope-Async': 'enable',
        'Content-Length': Buffer.byteLength(payload)
      }
    };
    const req = https.request(options, (apiRes) => {
      let data = '';
      apiRes.on('data', c => { data += c; });
      apiRes.on('end', () => {
        try {
          const result = JSON.parse(data);
          const taskId = result?.output?.task_id;
          if (taskId) resolve(taskId);
          else reject(new Error('创建任务失败: ' + data));
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// 轮询任务状态
function pollTask(taskId, timeoutSec) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutSec * 1000;
    const check = () => {
      if (Date.now() > deadline) return reject(new Error('ASR 超时'));
      const options = {
        hostname: 'dashscope.aliyuncs.com',
        path: `/api/v1/tasks/${taskId}`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY}` }
      };
      const req = https.request(options, (apiRes) => {
        let data = '';
        apiRes.on('data', c => { data += c; });
        apiRes.on('end', () => {
          try {
            const result = JSON.parse(data);
            const status = result?.output?.task_status;
            if (status === 'SUCCEEDED') {
              // 取第一个 result 的 transcription_url
              const url = result?.output?.results?.[0]?.transcription_url;
              if (url) resolve(url);
              else reject(new Error('找不到 transcription_url: ' + data));
            } else if (status === 'FAILED') {
              reject(new Error('任务失败: ' + data));
            } else {
              setTimeout(check, 500);
            }
          } catch (e) { reject(e); }
        });
      });
      req.on('error', reject);
      req.end();
    };
    check();
  });
}

// 获取转写结果 JSON
function fetchTranscription(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          // 提取所有 channel 的文字并拼接
          const transcripts = json?.transcripts || [];
          const text = transcripts.map(t => t.text || '').join(' ').trim();
          resolve(text || '');
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

module.exports = router;


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
