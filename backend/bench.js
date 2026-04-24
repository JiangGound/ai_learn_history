/**
 * 延迟基准测试：
 * 1. ASR：生成 3 秒静音 WAV → 上传 → 识别完成
 * 2. TTS：发送文字 → 收到 base64 音频（首包到完整）
 */
const https = require('https');
const http  = require('http');
const FormData = require('form-data');

const BASE = process.env.TEST_URL || 'https://ai-learn-history.onrender.com';

// ── 工具 ─────────────────────────────────────────────────

function httpPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const opts = {
      hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname, method: 'POST', headers
    };
    const req = lib.request(opts, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// 生成 PCM-16 静音 WAV（duration 秒, 单声道 16kHz）
function makeSilentWav(durationSec = 3) {
  const sampleRate = 16000, numChannels = 1, bitsPerSample = 16;
  const numSamples = sampleRate * durationSec;
  const dataSize = numSamples * numChannels * (bitsPerSample / 8);
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(numChannels, 22); buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * numChannels * bitsPerSample / 8, 28);
  buf.writeUInt16LE(numChannels * bitsPerSample / 8, 32);
  buf.writeUInt16LE(bitsPerSample, 34); buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  // PCM data 已经是零（静音）
  return buf;
}

// ── 测试 1：ASR ───────────────────────────────────────────
async function benchASR() {
  console.log('\n=== ASR 延迟测试 (3 秒静音 WAV) ===');
  const wavBuf = makeSilentWav(3);
  const fd = new FormData();
  fd.append('audio', wavBuf, { filename: 'recording.wav', contentType: 'audio/wav' });
  const body = fd.getBuffer();
  const headers = { ...fd.getHeaders(), 'Content-Length': body.length };

  const t0 = Date.now();
  console.log('发送中...');
  const res = await httpPost(`${BASE}/api/asr`, body, headers);
  const elapsed = Date.now() - t0;
  const data = JSON.parse(res.body);
  console.log(`耗时: ${elapsed} ms`);
  console.log(`识别结果: "${data.text || '(空)'}"`);
  return elapsed;
}

// ── 测试 2：TTS ───────────────────────────────────────────
async function benchTTS(isWarm) {
  const label = isWarm ? '(缓存实例，第2次)' : '(冷启动，第1次)';
  console.log(`\n=== TTS 延迟测试 ${label} ===`);
  const payload = JSON.stringify({ text: '轻摇羽扇，目光深邃，与汝一叙，甚感欣慰。', gender: 'male' });
  const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) };

  const t0 = Date.now();
  console.log('发送中...');
  const res = await httpPost(`${BASE}/api/tts`, Buffer.from(payload), headers);
  const elapsed = Date.now() - t0;
  const data = JSON.parse(res.body);
  const audioKB = data.audio ? Math.round(data.audio.length * 0.75 / 1024) : 0;
  console.log(`耗时: ${elapsed} ms`);
  console.log(`音频大小: ${audioKB} KB`);
  if (!data.audio) console.log('错误:', data);
  return elapsed;
}

// ── 主流程 ────────────────────────────────────────────────
async function main() {
  console.log(`测试目标: ${BASE}`);
  try {
    const asrMs  = await benchASR();
    const tts1Ms = await benchTTS(false);
    await new Promise(r => setTimeout(r, 300));
    const tts2Ms = await benchTTS(true);

    console.log('\n========== 汇总 ==========');
    console.log(`ASR 耗时:          ${asrMs} ms`);
    console.log(`TTS 冷启动 (首次): ${tts1Ms} ms`);
    console.log(`TTS 缓存实例(次):  ${tts2Ms} ms`);
    console.log('==========================');
    console.log('\n说明：');
    console.log('- ASR 包含：上传+DashScope任务队列+识别+轮询');
    console.log('- TTS 包含：WebSocket连接/复用+Edge TTS合成+传输');
    console.log('- 在 Render 免费版上有额外冷启动延迟（首次请求约+3s）');
  } catch (e) {
    console.error('测试失败:', e.message);
  }
}

main();
