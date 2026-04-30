const jwt = require('jsonwebtoken');
const VisitLog = require('../models/VisitLog');

const FEATURE_MAP = {
  '/api/chat': 'chat',
  '/api/group-chat': 'group-chat',
  '/api/tts': 'tts',
  '/api/asr': 'asr',
  '/api/characters': 'characters',
  '/api/conversations': 'conversations',
  '/api/auth': 'auth',
  '/api/data': 'data',
};

function getFeature(path) {
  for (const prefix of Object.keys(FEATURE_MAP)) {
    if (path.startsWith(prefix)) return FEATURE_MAP[prefix];
  }
  return null;
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function getUserIdFromToken(req) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'ai_history_secret_change_in_prod');
    return decoded.userId || decoded.id || null;
  } catch {
    return null;
  }
}

module.exports = function visitLogger(req, res, next) {
  const feature = getFeature(req.path);
  if (!feature) return next();

  const ip = getClientIp(req);
  const userId = getUserIdFromToken(req);
  const date = new Date().toISOString().slice(0, 10);

  res.on('finish', () => {
    VisitLog.create({ date, ip, userId, feature, method: req.method, path: req.path }).catch(() => {});
  });

  next();
};
