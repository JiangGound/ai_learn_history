const express = require('express');
const router = express.Router();
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