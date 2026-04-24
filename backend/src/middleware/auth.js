const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'ai_history_secret_change_in_prod';

/**
 * 必须登录的中间件
 */
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: '未登录' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token 无效或已过期，请重新登录' });
  }
}

/**
 * 可选登录中间件（不强制，但有 token 就解析）
 */
function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try { req.user = jwt.verify(token, JWT_SECRET); } catch {}
  }
  next();
}

module.exports = { requireAuth, optionalAuth };
