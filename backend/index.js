const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

// 导入数据库连接
const connectDB = require('./src/config/db');

// 导入路由
const characterRoutes = require('./src/routes/characterRoutes');
const chatRoutes = require('./src/routes/chatRoutes');
const dataRoutes = require('./src/routes/dataRoutes');
const conversationRoutes = require('./src/routes/conversationRoutes');
const ttsRoutes = require('./src/routes/ttsRoutes');
const asrRoutes = require('./src/routes/asrRoutes');

const app = express();
const PORT = process.env.PORT || 8000;

// 中间件
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// 路由
app.use('/api/characters', characterRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/tts', ttsRoutes);
app.use('/api/asr', asrRoutes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 启动服务器
const startServer = async () => {
  try {
    // 连接数据库
    await connectDB();
    
    // 启动服务器
    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('启动服务器失败:', error);
  }
};

startServer();