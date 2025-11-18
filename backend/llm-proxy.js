const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors({
  origin: ['chrome-extension://*', 'http://localhost:3000'],
}));

// API 配置（从环境变量读取）
const API_CONFIG = {
  deepseek: {
    url: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1',
    key: process.env.DEEPSEEK_API_KEY,
    model: 'deepseek-chat',
  },
  zhipu: {
    url: process.env.ZHIPU_API_URL || 'https://api.zhipuai.cn/v1',
    key: process.env.ZHIPU_API_KEY,
    model: 'glm-4',
  },
  qwen: {
    url: process.env.QWEN_API_URL || 'https://dashscope.aliyuncs.com/api/v1',
    key: process.env.QWEN_API_KEY,
    model: 'qwen-max',
  },
};

const userRateLimits = new Map();
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT_PER_HOUR || '100');

/**
 * 调用 LLM 接口
 */
app.post('/api/llm', async (req, res) => {
  try {
    const { prompt, model = process.env.DEFAULT_MODEL || 'deepseek', temperature, maxTokens, userId } = req.body;

    // 检查限流
    if (!checkRateLimit(userId)) {
      return res.status(429).json({ error: '请求过于频繁，请稍后再试' });
    }

    // 验证 API 配置
    if (!API_CONFIG[model]) {
      return res.status(400).json({ error: `不支持的模型: ${model}` });
    }

    if (!API_CONFIG[model].key) {
      return res.status(500).json({ error: `模型 ${model} 未配置 API 密钥` });
    }

    // 调用对应 API
    let response;
    switch (model) {
      case 'deepseek':
        response = await callDeepSeek(prompt, temperature, maxTokens);
        break;
      case 'zhipu':
        response = await callZhipu(prompt, temperature, maxTokens);
        break;
      case 'qwen':
        response = await callQwen(prompt, temperature, maxTokens);
        break;
      default:
        return res.status(400).json({ error: `未知模型: ${model}` });
    }

    res.json({
      success: true,
      model,
      content: response,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('LLM proxy error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '模型请求失败',
    });
  }
});

/**
 * 流式返回
 */
app.post('/api/llm/stream', async (req, res) => {
  try {
    const { prompt, model = process.env.DEFAULT_MODEL || 'deepseek', userId } = req.body;

    if (!checkRateLimit(userId)) {
      return res.status(429).json({ error: '请求过于频繁' });
    }

    if (!API_CONFIG[model] || !API_CONFIG[model].key) {
      return res.status(400).json({ error: `模型未正确配置: ${model}` });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let streamResponse;
    switch (model) {
      case 'deepseek':
        streamResponse = await streamDeepSeek(prompt, res);
        break;
      case 'zhipu':
        streamResponse = await streamZhipu(prompt, res);
        break;
      case 'qwen':
        streamResponse = await streamQwen(prompt, res);
        break;
      default:
        res.write(`data: ${JSON.stringify({ error: '未知模型' })}\n\n`);
        res.end();
    }
  } catch (error) {
    console.error('Stream error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

/**
 * 获取可用模型列表和配置状态
 */
app.get('/api/llm/models', (req, res) => {
  const models = [];

  for (const [key, config] of Object.entries(API_CONFIG)) {
    models.push({
      id: key,
      name: key.charAt(0).toUpperCase() + key.slice(1),
      model: config.model,
      configured: !!config.key,
      url: config.url,
    });
  }

  res.json({
    models,
    default: process.env.DEFAULT_MODEL || 'deepseek',
  });
});

/**
 * 健康检查
 */
app.get('/api/health', (req, res) => {
  const configuredModels = Object.entries(API_CONFIG)
    .filter(([_, config]) => config.key)
    .map(([key]) => key);

  res.json({
    status: 'ok',
    configuredModels,
    hasValidConfig: configuredModels.length > 0,
  });
});

/**
 * DeepSeek API 调用
 */
async function callDeepSeek(prompt, temperature = 0.7, maxTokens = 2000) {
  const config = API_CONFIG.deepseek;
  try {
    const response = await axios.post(
      `${config.url}/chat/completions`,
      {
        model: config.model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: temperature || 0.7,
        max_tokens: maxTokens || 2000,
      },
      {
        headers: {
          Authorization: `Bearer ${config.key}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    throw new Error(`DeepSeek API error: ${error.message}`);
  }
}

/**
 * Zhipu API 调用
 */
async function callZhipu(prompt, temperature = 0.7, maxTokens = 2000) {
  const config = API_CONFIG.zhipu;
  try {
    const response = await axios.post(
      `${config.url}/chat/completions`,
      {
        model: config.model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: temperature || 0.7,
        max_tokens: maxTokens || 2000,
      },
      {
        headers: {
          Authorization: `Bearer ${config.key}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    throw new Error(`Zhipu API error: ${error.message}`);
  }
}

/**
 * Qwen API 调用
 */
async function callQwen(prompt, temperature = 0.7, maxTokens = 2000) {
  const config = API_CONFIG.qwen;
  try {
    const response = await axios.post(
      `${config.url}/services/aigc/text-generation/generation`,
      {
        model: config.model,
        input: {
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        },
        parameters: {
          temperature: temperature || 0.7,
          max_tokens: maxTokens || 2000,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${config.key}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    return response.data.output.text;
  } catch (error) {
    throw new Error(`Qwen API error: ${error.message}`);
  }
}

/**
 * DeepSeek 流式响应
 */
async function streamDeepSeek(prompt, res) {
  const config = API_CONFIG.deepseek;
  try {
    const response = await axios.post(
      `${config.url}/chat/completions`,
      {
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      },
      {
        headers: {
          Authorization: `Bearer ${config.key}`,
          'Content-Type': 'application/json',
        },
        responseType: 'stream',
        timeout: 30000,
      }
    );

    response.data.on('data', (chunk) => {
      const lines = chunk.toString().split('\n');
      lines.forEach((line) => {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data && data !== '[DONE]') {
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0].delta.content || '';
              if (content) {
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      });
    });

    response.data.on('end', () => {
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    });

    response.data.on('error', (error) => {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    });
  } catch (error) {
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
}

async function streamZhipu(prompt, res) {
  // 类似 streamDeepSeek 的实现
  res.write(`data: ${JSON.stringify({ content: 'Zhipu streaming not yet implemented' })}\n\n`);
  res.end();
}

async function streamQwen(prompt, res) {
  // 类似 streamDeepSeek 的实现
  res.write(`data: ${JSON.stringify({ content: 'Qwen streaming not yet implemented' })}\n\n`);
  res.end();
}

/**
 * 限流检查
 */
function checkRateLimit(userId) {
  const now = Date.now();
  const limit = userRateLimits.get(userId) || { count: 0, resetTime: now + 3600000 };

  if (now > limit.resetTime) {
    userRateLimits.set(userId, { count: 1, resetTime: now + 3600000 });
    return true;
  }

  if (limit.count < RATE_LIMIT) {
    limit.count++;
    userRateLimits.set(userId, limit);
    return true;
  }

  return false;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`LLM Proxy running on port ${PORT}`);
  console.log('Configured models:', Object.keys(API_CONFIG).filter(k => API_CONFIG[k].key));
});

module.exports = app;
