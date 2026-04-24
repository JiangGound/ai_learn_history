const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendCode, DEV_MODE } = require('../services/smsService');
const { requireAuth } = require('../middleware/auth');

const JWT_SECRET  = process.env.JWT_SECRET || 'ai_history_secret_change_in_prod';
const JWT_EXPIRES = '30d';

// 内存中存储验证码：phone → { code, expiresAt }
const codeStore = new Map();
const CODE_TTL_MS = 5 * 60 * 1000; // 5 分钟

// --- 工具 ---
function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function validatePhone(phone) {
  return /^1[3-9]\d{9}$/.test(phone);
}

// ── POST /api/auth/send-code ──────────────────────────────
// Body: { phone }
router.post('/send-code', async (req, res) => {
  const { phone } = req.body;
  if (!phone || !validatePhone(phone)) {
    return res.status(400).json({ error: '手机号格式不正确' });
  }

  // 限速：同一手机号 60 秒内不能重复请求
  const existing = codeStore.get(phone);
  if (existing && existing.expiresAt - CODE_TTL_MS + 60_000 > Date.now()) {
    return res.status(429).json({ error: '发送太频繁，请 60 秒后再试' });
  }

  const code = genCode();
  codeStore.set(phone, { code, expiresAt: Date.now() + CODE_TTL_MS });

  try {
    const result = await sendCode(phone, code);
    const resp = { message: '验证码已发送' };
    // 开发模式：把验证码返回给前端（方便调试，生产环境不会有此字段）
    if (DEV_MODE) resp.devCode = result.devCode;
    res.json(resp);
  } catch (e) {
    codeStore.delete(phone);
    console.error('短信发送失败:', e.message);
    res.status(500).json({ error: '短信发送失败，请稍后重试' });
  }
});

// ── POST /api/auth/verify ─────────────────────────────────
// Body: { phone, code, nickname? }
router.post('/verify', async (req, res) => {
  const { phone, code, nickname } = req.body;
  if (!phone || !code) return res.status(400).json({ error: '参数不完整' });

  const stored = codeStore.get(phone);
  if (!stored || stored.expiresAt < Date.now()) {
    return res.status(400).json({ error: '验证码已过期，请重新获取' });
  }
  if (stored.code !== String(code)) {
    return res.status(400).json({ error: '验证码错误' });
  }

  // 验证通过，清除验证码
  codeStore.delete(phone);

  // 获取或创建用户
  let user = await User.findOne({ phone });
  if (!user) {
    user = await User.create({
      phone,
      nickname: nickname || phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
    });
  } else if (nickname && user.nickname !== nickname) {
    user.nickname = nickname;
    await user.save();
  }

  const token = jwt.sign(
    { _id: user._id.toString(), phone: user.phone, nickname: user.nickname },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );

  res.json({ token, user: { _id: user._id, phone: user.phone, nickname: user.nickname } });
});

// ── GET /api/auth/me ──────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.user._id).select('-__v');
  if (!user) return res.status(404).json({ error: '用户不存在' });
  res.json(user);
});

// ── PUT /api/auth/nickname ────────────────────────────────
// Body: { nickname }
router.put('/nickname', requireAuth, async (req, res) => {
  const { nickname } = req.body;
  if (!nickname?.trim()) return res.status(400).json({ error: '昵称不能为空' });
  await User.findByIdAndUpdate(req.user._id, { nickname: nickname.trim() });
  res.json({ message: '昵称已更新' });
});

module.exports = router;
