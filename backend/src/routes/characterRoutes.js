const express = require('express');
const router = express.Router();
const https = require('https');
const Character = require('../models/Character');

// 获取所有历史人物
router.get('/', async (req, res) => {
  try {
    const characters = await Character.find();
    res.json(characters);
  } catch (error) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 根据ID获取历史人物
router.get('/:id', async (req, res) => {
  try {
    const character = await Character.findById(req.params.id);
    if (character) {
      res.json(character);
    } else {
      res.status(404).json({ error: '历史人物不存在' });
    }
  } catch (error) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 按需初始化历史人物详细资料（懒加载 + 永久缓存）
router.post('/:id/init', async (req, res) => {
  try {
    const character = await Character.findById(req.params.id);
    if (!character) return res.status(404).json({ error: '历史人物不存在' });

    // 已初始化，直接返回
    if (character.background && character.background !== '-') {
      return res.json(character);
    }

    // 调用 AI 生成详细资料
    const messages = [
      {
        role: 'system',
        content: '你是一个历史知识助手，擅长提供准确、详细的历史人物信息。请严格按照要求返回 JSON 格式数据。'
      },
      {
        role: 'user',
        content: `请提供历史人物「${character.name}」的详细资料，以 JSON 格式返回，包含以下字段：\n{\n  "description": "一句话简介，20字以内",\n  "background": "详细生平介绍，200-300字，包括生卒年、重要经历、主要成就",\n  "works": ["代表作或重要成就1", "代表作或重要成就2", "代表作或重要成就3"],\n  "knowledgeBoundary": "以第一人称说明知识边界，60-100字，说明该人物所处时代及所了解的历史范围，以及对后世和现代的无知"\n}\n只返回 JSON，不要其他内容。`
      }
    ];

    const aiText = await callTongyiAPI(messages);

    // 解析 AI 返回的 JSON
    let parsed;
    try {
      const match = aiText.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(match ? match[0] : aiText);
    } catch (e) {
      return res.status(500).json({ error: 'AI 返回数据解析失败' });
    }

    // 更新数据库（永久缓存）
    const updated = await Character.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          description: parsed.description || character.description,
          background: parsed.background || character.background,
          works: Array.isArray(parsed.works) ? parsed.works : [],
          knowledgeBoundary: parsed.knowledgeBoundary || character.knowledgeBoundary,
        }
      },
      { new: true }
    );

    res.json(updated);
  } catch (err) {
    console.error('初始化人物失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 调用通义千问 API
function callTongyiAPI(messages) {
  return new Promise((resolve, reject) => {
    const payload = {
      model: 'qwen-turbo',
      input: { messages },
      parameters: { temperature: 0.5 }
    };
    const options = {
      hostname: 'dashscope.aliyuncs.com',
      path: '/api/v1/services/aigc/text-generation/generation',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY}`
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.output && result.output.text) {
            resolve(result.output.text);
          } else {
            reject(new Error('Invalid API response: ' + JSON.stringify(result)));
          }
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify(payload));
    req.end();
  });
}

// 添加历史人物
router.post('/', async (req, res) => {
  try {
    const newCharacter = new Character(req.body);
    const savedCharacter = await newCharacter.save();
    res.json(savedCharacter);
  } catch (error) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 更新历史人物
router.put('/:id', async (req, res) => {
  try {
    const updatedCharacter = await Character.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (updatedCharacter) {
      res.json(updatedCharacter);
    } else {
      res.status(404).json({ error: '历史人物不存在' });
    }
  } catch (error) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 删除历史人物
router.delete('/:id', async (req, res) => {
  try {
    const deletedCharacter = await Character.findByIdAndDelete(req.params.id);
    if (deletedCharacter) {
      res.json({ message: '历史人物删除成功' });
    } else {
      res.status(404).json({ error: '历史人物不存在' });
    }
  } catch (error) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;