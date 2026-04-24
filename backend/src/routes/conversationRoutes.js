const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');
const { optionalAuth } = require('../middleware/auth');

// 所有路由注入可选登录信息
router.use(optionalAuth);

// 获取会话列表（已登录：只返回自己的；未登录：返回无 userId 的公共记录）
router.get('/', async (req, res) => {
  try {
    const filter = req.user
      ? { userId: req.user._id }
      : { userId: { $exists: false } };
    const conversations = await Conversation.find(filter)
      .select('-messages')
      .sort({ updatedAt: -1 })
      .limit(50);
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取单个会话（含全部消息）
router.get('/:id', async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ error: '会话不存在' });
    // 权限检查：属于当前用户，或是无主记录
    if (conversation.userId && (!req.user || conversation.userId.toString() !== req.user._id)) {
      return res.status(403).json({ error: '权限不足' });
    }
    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 删除会话
router.delete('/:id', async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ error: '会话不存在' });
    if (conversation.userId && (!req.user || conversation.userId.toString() !== req.user._id)) {
      return res.status(403).json({ error: '权限不足' });
    }
    await Conversation.findByIdAndDelete(req.params.id);
    res.json({ message: '会话已删除' });
  } catch (error) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
