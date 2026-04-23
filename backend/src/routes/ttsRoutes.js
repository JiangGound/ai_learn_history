const express = require('express');
const router = express.Router();
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

// 男/女音色映射（微软 Edge 神经网络 TTS）
const VOICE_MAP = {
  male: 'zh-CN-YunxiNeural',      // 男声：自然流畅
  female: 'zh-CN-XiaoxiaoNeural', // 女声：温柔自然
};

// 过滤掉 【神态描写】 段落，只保留正文供 TTS 朗读
function stripActions(text) {
  return text.replace(/【[^】]*】/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

// POST /api/tts  { text, gender }
router.post('/', async (req, res) => {
  const { text, gender = 'male' } = req.body;
  if (!text) return res.status(400).json({ error: '缺少 text 参数' });

  const cleanText = stripActions(text);
  if (!cleanText) return res.status(400).json({ error: '文本为空' });

  const voice = VOICE_MAP[gender] || VOICE_MAP.male;

  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const chunks = [];
    const { audioStream } = tts.toStream(cleanText);
    await new Promise((resolve, reject) => {
      audioStream.on('data', c => chunks.push(c));
      audioStream.on('end', resolve);
      audioStream.on('error', reject);
    });
    const audio = Buffer.concat(chunks).toString('base64');
    res.json({ audio });
  } catch (e) {
    console.error('TTS 错误:', e.message);
    res.status(500).json({ error: 'TTS 服务异常', detail: e.message });
  }
});

module.exports = router;

// 过滤掉 【神态描写】 段落，只保留正文供 TTS 朗读
function stripActions(text) {
  return text.replace(/【[^】]*】/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

// 通用 HTTPS JSON 请求
function httpsJSON(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse error: ' + data.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// 创建 TTS 异步任务，返回 task_id
function createTTSTask(cleanText, voice) {
  const payload = JSON.stringify({
    model: 'cosyvoice-v1',
    input: { text: cleanText },
    parameters: { voice, format: 'mp3', sample_rate: 22050 }
  });
  return httpsJSON({
    hostname: 'dashscope.aliyuncs.com',
    path: '/api/v1/services/aigc/text2audiov2/generation',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY}`,
      'X-DashScope-Async': 'enable',
      'Content-Length': Buffer.byteLength(payload)
    }
  }, payload);
}

// 轮询任务，返回音频 URL
function pollTTSTask(taskId, timeoutSec = 30) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutSec * 1000;
    const check = () => {
      if (Date.now() > deadline) return reject(new Error('TTS 任务超时'));
      httpsJSON({
        hostname: 'dashscope.aliyuncs.com',
        path: `/api/v1/tasks/${taskId}`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY}` }
      }).then(result => {
        const status = result?.output?.task_status;
        if (status === 'SUCCEEDED') {
          // audio_url 可能在 output 顶层或 output.results[0]
          const audioUrl =
            result?.output?.audio_url ||
            result?.output?.results?.[0]?.audio_url;
          if (audioUrl) return resolve(audioUrl);
          // 打印完整响应便于调试
          reject(new Error('找不到 audio_url: ' + JSON.stringify(result)));
        } else if (status === 'FAILED') {
          reject(new Error('TTS 任务失败: ' + JSON.stringify(result)));
        } else {
          setTimeout(check, 1500);
        }
      }).catch(reject);
    };
    check();
  });
}

// 下载音频 URL，返回 base64 字符串（自动跟随重定向）
function fetchAudioBase64(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchAudioBase64(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// POST /api/tts  { text, gender }
router.post('/', async (req, res) => {
  const { text, gender = 'male' } = req.body;
  if (!text) return res.status(400).json({ error: '缺少 text 参数' });

  const cleanText = stripActions(text);
  if (!cleanText) return res.status(400).json({ error: '文本为空' });

  const voice = VOICE_MAP[gender] || VOICE_MAP.male;

  try {
    // 1. 提交异步任务
    const taskResult = await createTTSTask(cleanText, voice);
    const taskId = taskResult?.output?.task_id;
    if (!taskId) {
      console.error('TTS 未返回 task_id:', JSON.stringify(taskResult));
      return res.status(500).json({ error: 'TTS 服务异常', detail: taskResult });
    }

    // 2. 轮询直到完成
    const audioUrl = await pollTTSTask(taskId);

    // 3. 下载并转 base64
    const audio = await fetchAudioBase64(audioUrl);
    res.json({ audio });
  } catch (e) {
    console.error('TTS 错误:', e.message);
    res.status(500).json({ error: 'TTS 服务异常', detail: e.message });
  }
});

module.exports = router;
