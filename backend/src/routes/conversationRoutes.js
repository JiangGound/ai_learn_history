const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');

// 获取会话列表（默认按最新更新排序，最多50条）
router.get('/', async (req, res) => {
  try {
    const conversations = await Conversation.find()
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
    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 删除会话
router.delete('/:id', async (req, res) => {
  try {
    await Conversation.findByIdAndDelete(req.params.id);
    res.json({ message: '会话已删除' });
  } catch (error) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
