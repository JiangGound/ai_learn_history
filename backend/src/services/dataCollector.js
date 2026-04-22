const https = require('https');
const Character = require('../models/Character');

// 使用通义千问API收集历史人物信息
async function collectCharacterInfo(name) {
  try {
    // 构建提示词
    const prompt = `请收集以下历史人物的详细信息，按照指定格式返回：

人物：${name}

请返回以下信息：
1. 描述：简要介绍该人物的身份和地位
2. 背景：详细的生平信息，包括出生日期、重要经历、主要成就
3. 时代背景：所处时代的政治、经济、文化环境
4. 主要作品：文学作品、学术著作、艺术创作等
5. 知识边界：该人物所了解的知识范围，例如"只了解XX时期及以前的历史文化，对后世和现代事物一无所知。"

请以JSON格式返回，字段名分别为：description, background, eraBackground, works, knowledgeBoundary`;

    // 调用通义千问API
    const response = await callTongyiAPI(prompt, `请收集${name}的详细信息`);
    
    // 解析API返回的JSON
    let characterData;
    try {
      // 提取JSON部分
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        characterData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('无法提取JSON数据');
      }
    } catch (error) {
      console.error('解析JSON失败:', error);
      throw new Error('解析API返回数据失败');
    }

    // 构建人物数据
    const character = {
      name,
      description: characterData.description || '',
      background: `${characterData.background || ''}\n\n时代背景：${characterData.eraBackground || ''}`,
      works: characterData.works ? (Array.isArray(characterData.works) ? characterData.works : [characterData.works]) : [],
      knowledgeBoundary: characterData.knowledgeBoundary || ''
    };

    // 保存到数据库
    const savedCharacter = await saveCharacterToDB(character);
    return savedCharacter;
  } catch (error) {
    console.error('收集人物信息失败:', error);
    throw error;
  }
}

// 调用通义千问API
function callTongyiAPI(systemPrompt, userMessage) {
  return new Promise((resolve, reject) => {
    const payload = {
      model: 'qwen-turbo',
      input: {
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userMessage
          }
        ],
        temperature: 0.7
      }
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
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.output && result.output.text) {
            resolve(result.output.text);
          } else {
            reject(new Error('Invalid response from API'));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(JSON.stringify(payload));
    req.end();
  });
}

// 保存人物信息到数据库
async function saveCharacterToDB(characterData) {
  try {
    // 检查是否已存在
    const existingCharacter = await Character.findOne({ name: characterData.name });
    if (existingCharacter) {
      // 更新现有人物
      const updatedCharacter = await Character.findByIdAndUpdate(existingCharacter._id, characterData, { new: true });
      return updatedCharacter;
    } else {
      // 创建新人物
      const newCharacter = new Character(characterData);
      const savedCharacter = await newCharacter.save();
      return savedCharacter;
    }
  } catch (error) {
    console.error('保存人物信息失败:', error);
    throw error;
  }
}

module.exports = {
  collectCharacterInfo
};