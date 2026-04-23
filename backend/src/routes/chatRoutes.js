const express = require('express');
const router = express.Router();
const https = require('https');
const Character = require('../models/Character');
const Conversation = require('../models/Conversation');

// 对话处理
router.post('/', async (req, res) => {
  const { characterId, message, conversationId, conversationHistory = [] } = req.body;

  try {
    // 从数据库查找历史人物
    const character = await Character.findById(characterId);
    if (!character) {
      return res.status(404).json({ error: '历史人物不存在' });
    }

    // 构建系统提示词
    const systemPrompt = `你是${character.name}，${character.background}。${character.knowledgeBoundary}请始终以${character.name}的口吻和视角回答问题。如需加入神态、表情或动作描写，请用【】括起来放在回答段首，例如：【轻摇羽扇，目光深邃】正文内容……`;

    // 构建多轮消息数组（含历史上下文）
    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message }
    ];

    // 调用通义千问API
    const response = await callTongyiAPI(apiMessages);

    // 自动保存/更新会话记录
    const newMsgs = [
      { role: 'user', content: message },
      { role: 'assistant', content: response }
    ];
    let conv;
    if (conversationId) {
      conv = await Conversation.findByIdAndUpdate(
        conversationId,
        { $push: { messages: { $each: newMsgs } } },
        { new: true }
      );
    } else {
      conv = await Conversation.create({
        characterId,
        characterName: character.name,
        title: message.slice(0, 30),
        messages: newMsgs
      });
    }

    res.json({ response, conversationId: conv._id });
  } catch (error) {
    console.error('Error calling Tongyi API:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 调用通义千问API（支持多轮消息数组）
function callTongyiAPI(messages) {
  return new Promise((resolve, reject) => {
    const payload = {
      model: 'qwen-turbo',
      input: { messages },
      parameters: { temperature: 0.7 }
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
            reject(new Error('Invalid response from API: ' + JSON.stringify(result)));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(payload));
    req.end();
  });
}

module.exports = router;