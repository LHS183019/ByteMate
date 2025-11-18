const express = require('express');
const cors = require('cors');
require('dotenv').config(); // 从 .env 读取密钥

const app = express();
app.use(express.json());
app.use(cors({
  origin: ['chrome-extension://*'], // 仅允许扩展访问
}));

// API 密钥（从环境变量读取，绝不在代码中暴露）
const API_KEYS = {
  openai: process.env.OPENAI_API_KEY,
  deepseek: process.env.DEEPSEEK_API_KEY,
  zhipu: process.env.ZHIPU_API_KEY,
  qwen: process.env.QWEN_API_KEY,
  groq: process.env.GROQ_API_KEY,
};

// 用户限流配置
const userRateLimits = new Map();

/**
 * 调用 LLM 接口
 */
app.post('/api/llm', async (req, res) => {
  try {
    const { prompt, model, temperature, maxTokens, userId } = req.body;

    // 检查限流
    if (!checkRateLimit(userId)) {
      return res.status(429).json({ error: '请求过于频繁' });
    }

    // 根据模型调用对应 API
    let response;
    if (model.includes('gpt')) {
      response = await callOpenAI(prompt, model, temperature, maxTokens);
    } else if (model.includes('deepseek')) {
      response = await callDeepSeek(prompt, temperature, maxTokens);
    } else if (model.includes('zhipu')) {
      response = await callZhipu(prompt, temperature, maxTokens);
    } else if (model.includes('qwen')) {
      response = await callQwen(prompt, temperature, maxTokens);
    } else {
      response = await callGroq(prompt, temperature, maxTokens);
    }

    res.json({ content: response });
  } catch (error) {
    console.error('LLM proxy error:', error);
    res.status(500).json({ error: '模型请求失败' });
  }
});

/**
 * 流式返回
 */
app.post('/api/llm/stream', async (req, res) => {
  try {
    const { prompt, model, userId } = req.body;

    if (!checkRateLimit(userId)) {
      return res.status(429).json({ error: '请求过于频繁' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // 根据模型调用流式 API
    // ...实现流式处理
  } catch (error) {
    res.status(500).json({ error: 'Stream failed' });
  }
});

/**
 * 获取可用模型列表
 */
app.get('/api/llm/models', (req, res) => {
  res.json({
    models: [
      'gpt-4',
      'gpt-3.5-turbo',
      'deepseek-chat',
      'zhipu-pro',
      'qwen-max',
      'groq-mixtral',
    ],
  });
});

// ...具体 API 调用实现
async function callOpenAI(prompt, model, temperature, maxTokens) {
  // 使用 API_KEYS.openai 调用 OpenAI API
}

async function callDeepSeek(prompt, temperature, maxTokens) {
  // 使用 API_KEYS.deepseek 调用 DeepSeek API
}

// 限流检查
function checkRateLimit(userId) {
  const now = Date.now();
  const limit = userRateLimits.get(userId) || { count: 0, resetTime: now + 3600000 };

  if (now > limit.resetTime) {
    userRateLimits.set(userId, { count: 1, resetTime: now + 3600000 });
    return true;
  }

  if (limit.count < 100) { // 每小时 100 次
    limit.count++;
    userRateLimits.set(userId, limit);
    return true;
  }

  return false;
}

app.listen(3000, () => console.log('LLM Proxy running on port 3000'));
module.exports = app;
