const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');
const { optionalAuth } = require('../middleware/auth');

// 所有路由注入可选登录信息
router.use(optionalAuth);

// 创建或更新群聊会话（群聊/群通话专用）
router.post('/', async (req, res) => {
  const { conversationId, characterIds, characterNames, messages, title } = req.body;
  if (!Array.isArray(messages) || !characterNames?.length) {
    return res.status(400).json({ error: '缺少必要参数' });
  }
  try {
    let conv;
    if (conversationId) {
      conv = await Conversation.findById(conversationId);
      if (conv) {
        // 权限检查
        if (conv.userId && (!req.user || conv.userId.toString() !== req.user._id.toString())) {
          return res.status(403).json({ error: '权限不足' });
        }
        conv.messages = messages;
        conv.updatedAt = new Date();
        await conv.save();
        return res.json({ conversationId: conv._id });
      }
    }
    // 新建群聊会话
    conv = await Conversation.create({
      userId:         req.user?._id || undefined,
      characterId:    characterIds?.[0] || undefined,
      characterName:  characterNames.join(' · '),
      characterNames,
      isGroup:        true,
      title:          title || characterNames.join(' · '),
      messages
    });
    res.json({ conversationId: conv._id });
  } catch (err) {
    console.error('保存群聊会话失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

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
