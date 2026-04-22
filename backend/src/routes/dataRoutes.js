const express = require('express');
const router = express.Router();
const { collectCharacterInfo } = require('../services/dataCollector');

// 收集历史人物信息
router.post('/collect', async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: '请提供历史人物姓名' });
  }

  try {
    const character = await collectCharacterInfo(name);
    res.json({ success: true, character });
  } catch (error) {
    console.error('收集人物信息失败:', error);
    res.status(500).json({ error: '收集人物信息失败' });
  }
});

// 批量收集历史人物信息
router.post('/collect/batch', async (req, res) => {
  const { names } = req.body;

  if (!names || !Array.isArray(names)) {
    return res.status(400).json({ error: '请提供历史人物姓名列表' });
  }

  try {
    const results = [];
    for (const name of names) {
      try {
        const character = await collectCharacterInfo(name);
        results.push({ name, success: true, character });
      } catch (error) {
        results.push({ name, success: false, error: error.message });
      }
    }
    res.json({ success: true, results });
  } catch (error) {
    console.error('批量收集人物信息失败:', error);
    res.status(500).json({ error: '批量收集人物信息失败' });
  }
});

module.exports = router;