const express = require('express');
const router = express.Router();
const https = require('https');
const Character = require('../models/Character');
const { optionalAuth } = require('../middleware/auth');

// 群聊：每次请求返回一个角色的发言
router.post('/', optionalAuth, async (req, res) => {
  const { characterIds, message, conversationHistory = [], speakerIndex = 0 } = req.body;

  if (!characterIds || characterIds.length < 2 || characterIds.length > 3) {
    return res.status(400).json({ error: '群聊需要2-3个历史人物' });
  }
  if (speakerIndex < 0 || speakerIndex >= characterIds.length) {
    return res.status(400).json({ error: '无效的发言者索引' });
  }

  try {
    const characters = await Character.find({ _id: { $in: characterIds } });
    // 按 characterIds 顺序排列，保证轮次正确
    const orderedChars = characterIds
      .map(id => characters.find(c => c._id.toString() === id))
      .filter(Boolean);

    const speaker = orderedChars[speakerIndex];
    const others = orderedChars.filter((_, i) => i !== speakerIndex);

    const systemPrompt = `你是${speaker.name}${speaker.dynasty ? `（${speaker.dynasty}时期）` : ''}，${speaker.description}。
${speaker.background || ''}${speaker.knowledgeBoundary || ''}

【群聊情境】你正在参与一场跨越时空的聚会，在场的还有：${others.map(c => `${c.name}（${c.description}）`).join('、')}。你们来自不同时代，彼此思想碰撞。
现在轮到你发言，请：
- 完全以${speaker.name}的口吻和历史视角自然回应当前话题
- 可以回应或反驳其他历史人物的观点，制造时代碰撞感
- 如果想和某位在场的历史人物直接对话，可以直接点名他们
- 动作/神情用【】标注，放在段首（如【轻抚胡须，若有所思】）
- 回复简洁自然，不超过100字
- 不要在回复里重复说自己的名字`;

    // 无用户消息时为自由讨论模式，补充提示
    const freeDiscussionHint = !message
      ? [{ role: 'user', content: '（请继续自由讨论，延续刚才的话题，可主动向在场其他人物发问或表达观点）' }]
      : [{ role: 'user', content: message }]

    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.role === 'assistant' && m.speakerName
          ? `[${m.speakerName}]: ${m.content}`
          : m.content
      })),
      ...freeDiscussionHint
    ];

    const response = await callTongyiAPI(apiMessages);

    res.json({
      response,
      speakerIndex,
      speakerId: speaker._id,
      speakerName: speaker.name,
      speakerGender: speaker.gender
    });
  } catch (err) {
    console.error('Group chat error:', err);
    res.status(500).json({ error: '群聊请求失败' });
  }
});

function callTongyiAPI(messages) {
  return new Promise((resolve, reject) => {
    const payload = {
      model: 'qwen-turbo',
      input: { messages },
      parameters: { temperature: 0.8 }
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

    const req = https.request(options, (apiRes) => {
      let data = '';
      apiRes.on('data', chunk => { data += chunk; });
      apiRes.on('end', () => {
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

module.exports = router;
