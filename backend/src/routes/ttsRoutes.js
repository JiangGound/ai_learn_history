const express = require('express');
const router = express.Router();
const https = require('https');

// 男/女音色映射（CosyVoice）
const VOICE_MAP = {
  male: 'longxiaochun',   // 男声：稳重磁性
  female: 'longxiaoxia',  // 女声：温柔清澈
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
  const voice = VOICE_MAP[gender] || VOICE_MAP.male;

  const payload = JSON.stringify({
    model: 'cosyvoice-v1',
    input: { text: cleanText, voice },
    parameters: { format: 'mp3', sample_rate: 22050 }
  });

  const options = {
    hostname: 'dashscope.aliyuncs.com',
    path: '/api/v1/services/aigc/text2audiov2/generation',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY}`,
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  const apiReq = https.request(options, (apiRes) => {
    let data = '';
    apiRes.on('data', chunk => { data += chunk; });
    apiRes.on('end', () => {
      try {
        const result = JSON.parse(data);
        // DashScope TTS 返回 base64 音频
        const audio = result?.output?.audio;
        if (audio) {
          res.json({ audio }); // base64 mp3
        } else {
          console.error('TTS API 返回异常:', JSON.stringify(result));
          res.status(500).json({ error: 'TTS 服务异常', detail: result });
        }
      } catch (e) {
        res.status(500).json({ error: '解析 TTS 响应失败' });
      }
    });
  });

  apiReq.on('error', (e) => res.status(500).json({ error: e.message }));
  apiReq.write(payload);
  apiReq.end();
});

module.exports = router;
