const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const VisitLog = require('../models/VisitLog');
const User = require('../models/User');

const FEATURE_LABELS = {
  'chat': '单人对话',
  'group-chat': '群聊',
  'tts': '文字转语音',
  'asr': '语音识别',
  'characters': '历史人物',
  'conversations': '对话记录',
  'auth': '用户认证',
  'data': '数据采集',
};

const ADMIN_PHONE = process.env.ADMIN_PHONE || '15502236175';

// 鉴权：验证 JWT 并确认是管理员账号
async function statsAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: '未登录' });
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'ai_history_secret_change_in_prod');
    const user = await User.findById(decoded._id || decoded.userId).lean();
    if (!user || user.phone !== ADMIN_PHONE) return res.status(403).json({ error: '无权限' });
    next();
  } catch {
    res.status(401).json({ error: '无效凭证' });
  }
}

// GET /api/stats?date=YYYY-MM-DD  （默认今天）
router.get('/', statsAuth, async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const logs = await VisitLog.find({ date }).lean();

    const totalRequests = logs.length;
    const uniqueIps = new Set(logs.map(l => l.ip)).size;
    const uniqueUsers = new Set(logs.filter(l => l.userId).map(l => l.userId.toString())).size;

    // 功能使用次数
    const featureCounts = {};
    for (const log of logs) {
      featureCounts[log.feature] = (featureCounts[log.feature] || 0) + 1;
    }

    // 小时分布（0-23）
    const hourlyDistribution = Array(24).fill(0);
    for (const log of logs) {
      const hour = new Date(log.createdAt).getHours();
      hourlyDistribution[hour]++;
    }

    // 按使用量排序的功能列表
    const topFeatures = Object.entries(featureCounts)
      .map(([feature, count]) => ({ feature, label: FEATURE_LABELS[feature] || feature, count }))
      .sort((a, b) => b.count - a.count);

    res.json({
      date,
      totalRequests,
      uniqueVisitors: uniqueIps,
      loggedInUsers: uniqueUsers,
      topFeatures,
      featureCounts,
      hourlyDistribution,
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: '统计数据获取失败' });
  }
});

// GET /api/stats/recent?days=7  最近 N 天概览（最多30天）
router.get('/recent', statsAuth, async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 7, 30);
    const dates = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }

    const logs = await VisitLog.find({ date: { $in: dates } }).lean();

    const byDate = {};
    for (const date of dates) {
      byDate[date] = { date, totalRequests: 0, uniqueVisitors: new Set(), features: {} };
    }
    for (const log of logs) {
      if (!byDate[log.date]) continue;
      byDate[log.date].totalRequests++;
      byDate[log.date].uniqueVisitors.add(log.ip);
      byDate[log.date].features[log.feature] = (byDate[log.date].features[log.feature] || 0) + 1;
    }

    const summary = dates.map(date => ({
      date,
      totalRequests: byDate[date].totalRequests,
      uniqueVisitors: byDate[date].uniqueVisitors.size,
      topFeature: Object.entries(byDate[date].features).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
      topFeatureLabel: FEATURE_LABELS[Object.entries(byDate[date].features).sort((a, b) => b[1] - a[1])[0]?.[0]] || null,
    }));

    res.json({ days, summary });
  } catch (err) {
    console.error('Stats recent error:', err);
    res.status(500).json({ error: '统计数据获取失败' });
  }
});

module.exports = router;
