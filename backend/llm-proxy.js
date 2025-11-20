const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 日志中间件
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  if (Object.keys(req.body).length > 0) {
    console.log('Body:', JSON.stringify(req.body).substring(0, 200));
  }
  next();
});

// 初始化 OpenAI 兼容客户端
const getLLMClient = () => {
  const provider = process.env.LLM_PROVIDER || 'deepseek';

  const configs = {
    deepseek: {
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    },
    qwen: {
      apiKey: process.env.QWEN_API_KEY,
      baseURL: process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: process.env.QWEN_MODEL || 'qwen-plus',
    },
    zhipu: {
      apiKey: process.env.ZHIPU_API_KEY,
      baseURL: process.env.ZHIPU_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4',
      model: process.env.ZHIPU_MODEL || 'glm-4',
    },
  };

  const config = configs[provider];
  if (!config) {
    throw new Error(`LLM 提供商 ${provider} 未配置`);
  }

  if (!config.apiKey) {
    throw new Error(`${provider.toUpperCase()}_API_KEY 缺失，请检查 .env 文件`);
  }

  console.log(`[LLM-CLIENT] Using ${provider} with model: ${config.model}`);
  console.log(`[LLM-CLIENT] Base URL: ${config.baseURL}`);
  console.log(`[LLM-CLIENT] API Key: ${config.apiKey.substring(0, 10)}...`);

  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });
};

// 检查 API 配置
const hasValidConfig = () => {
  try {
    getLLMClient();
    return true;
  } catch (error) {
    console.error('[CONFIG-CHECK]', error.message);
    return false;
  }
};

/**
 * 测试端点 - 用于快速诊断
 */
app.get('/api/test', (req, res) => {
  const testInfo = {
    timestamp: Date.now(),
    provider: process.env.LLM_PROVIDER || 'deepseek',
    hasApiKey: !!(
      process.env.DEEPSEEK_API_KEY ||
      process.env.QWEN_API_KEY ||
      process.env.ZHIPU_API_KEY
    ),
    apiKeyLength: {
      deepseek: process.env.DEEPSEEK_API_KEY?.length || 0,
      qwen: process.env.QWEN_API_KEY?.length || 0,
      zhipu: process.env.ZHIPU_API_KEY?.length || 0,
    },
    baseUrl: {
      deepseek: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
      qwen: process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      zhipu: process.env.ZHIPU_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4',
    },
    models: {
      deepseek: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      qwen: process.env.QWEN_MODEL || 'qwen-plus',
      zhipu: process.env.ZHIPU_MODEL || 'glm-4',
    },
  };

  res.json({
    status: 'ok',
    config: testInfo,
    message: hasValidConfig()
      ? 'LLM 服务已配置'
      : 'LLM 服务未配置，请检查 .env 文件',
  });
});

/**
 * 简单的 LLM 测试端点
 */
app.post('/api/test-llm', async (req, res) => {
  try {
    console.log('[TEST-LLM] Starting test...');

    if (!hasValidConfig()) {
      return res.status(503).json({
        success: false,
        error: 'LLM 未配置',
        details: 'API Key 或 Base URL 缺失',
      });
    }

    const client = getLLMClient();
    const provider = process.env.LLM_PROVIDER || 'deepseek';
    const model = process.env[`${provider.toUpperCase()}_MODEL`] ||
      { deepseek: 'deepseek-chat', qwen: 'qwen-plus', zhipu: 'glm-4' }[provider];

    console.log(`[TEST-LLM] Using model: ${model}`);

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'user',
          content: '你好，请简短回复"我是AI助手"',
        },
      ],
      temperature: 0.7,
      max_tokens: 100,
    });

    const content = response.choices[0].message.content;
    console.log('[TEST-LLM] Response received:', content);

    res.json({
      success: true,
      message: 'LLM 测试成功',
      content,
      model: response.model,
      provider,
    });
  } catch (error) {
    console.error('[TEST-LLM] Error:', error.message);
    console.error('[TEST-LLM] Error details:', error);

    res.status(500).json({
      success: false,
      error: error.message,
      errorCode: error.code || 'UNKNOWN',
      provider: process.env.LLM_PROVIDER || 'deepseek',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      troubleshooting: {
        1: '检查 API Key 是否正确：https://platform.deepseek.com/api_keys',
        2: '确认 API Key 有足够权限',
        3: '检查模型名称是否正确',
        4: '检查 Base URL 是否正确',
        5: '确认网络连接正常',
      },
    });
  }
});

/**
 * 健康检查端点
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasValidConfig: hasValidConfig(),
    provider: process.env.LLM_PROVIDER || 'deepseek',
    timestamp: Date.now(),
  });
});

/**
 * 非流式调用 LLM
 */
app.post('/api/llm', async (req, res) => {
  if (!hasValidConfig()) {
    return res.status(503).json({
      error: 'LLM 服务未配置',
      success: false,
    });
  }

  try {
    const { prompt, model, temperature, maxTokens } = req.body;
    const client = getLLMClient();
    const provider = process.env.LLM_PROVIDER || 'deepseek';

    const configMap = {
      deepseek: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      qwen: process.env.QWEN_MODEL || 'qwen-plus',
      zhipu: process.env.ZHIPU_MODEL || 'glm-4',
    };

    const selectedModel = model || configMap[provider];

    console.log(`[LLM-REQUEST] Model: ${selectedModel}, Prompt length: ${prompt.length}`);

    const response = await client.chat.completions.create({
      model: selectedModel,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: temperature || 0.7,
      max_tokens: maxTokens || 2000,
    });

    const content = response.choices[0]?.message?.content || '';

    res.json({
      success: true,
      content,
      model: response.model,
      usage: response.usage,
    });
  } catch (error) {
    console.error('[LLM-REQUEST] Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      errorCode: error.code,
    });
  }
});

/**
 * 流式调用 LLM
 */
app.post('/api/llm/stream', async (req, res) => {
  if (!hasValidConfig()) {
    return res.status(503).json({
      error: 'LLM 服务未配置',
      success: false,
    });
  }

  try {
    const { prompt, model } = req.body;
    const client = getLLMClient();
    const provider = process.env.LLM_PROVIDER || 'deepseek';

    const configMap = {
      deepseek: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      qwen: process.env.QWEN_MODEL || 'qwen-plus',
      zhipu: process.env.ZHIPU_MODEL || 'glm-4',
    };

    const selectedModel = model || configMap[provider];

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = await client.chat.completions.create({
      model: selectedModel,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n`);
      }
      if (chunk.choices[0]?.finish_reason === 'stop') {
        res.write(`data: ${JSON.stringify({ done: true })}\n`);
      }
    }

    res.end();
  } catch (error) {
    console.error('[STREAM-REQUEST] Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 获取可用模型列表
 */
app.get('/api/llm/models', (req, res) => {
  const models = {
    deepseek: { id: 'deepseek-chat', name: 'DeepSeek Chat' },
    qwen: { id: 'qwen-plus', name: 'Qwen Plus' },
    zhipu: { id: 'glm-4', name: 'ZhiPu GLM-4' },
  };

  const provider = process.env.LLM_PROVIDER || 'deepseek';
  res.json({
    currentProvider: provider,
    models: [models[provider]],
  });
});

/**
 * 处理题目问题的统一端点
 */
app.post('/api/assist', async (req, res) => {
  if (!hasValidConfig()) {
    return res.status(503).json({
      error: 'LLM 服务未配置',
      success: false,
    });
  }

  try {
    const {
      feature,
      title,
      statement,
      currentCode,
      samples,
      problemId,
      customPrompt,
      responseFormat = 'text' // 新增：支持指定响应格式
    } = req.body;

    const basePrompt = customPrompt || `你是一个编程教师。\n`;
    
    // 修改：移除JSON格式要求，改为文字回复
    const fullPrompt = `${basePrompt}

题目标题: ${title}
题目描述: ${statement}

当前用户代码:
\`\`\`javascript
${currentCode || '// 用户还未提交代码'}
\`\`\`

示例:
${samples ? samples.map((s, i) => `示例${i + 1}:\n输入: ${s.input}\n输出: ${s.output}`).join('\n') : '无'}

请用清晰易懂的文字回复，不要使用JSON格式。`;

    const client = getLLMClient();
    const provider = process.env.LLM_PROVIDER || 'deepseek';

    const configMap = {
      deepseek: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      qwen: process.env.QWEN_MODEL || 'qwen-plus',
      zhipu: process.env.ZHIPU_MODEL || 'glm-4',
    };

    console.log(`[ASSIST] Feature: ${feature}, Problem: ${problemId}`);

    const response = await client.chat.completions.create({
      model: configMap[provider],
      messages: [
        {
          role: 'user',
          content: fullPrompt,
        },
      ],
      temperature: 0.6,
      max_tokens: 3000,
    });

    const content = response.choices[0]?.message?.content || '';

    // 修改：直接返回字符串内容，不解析JSON
    const result = content;

    res.json({
      success: true,
      feature,
      problemId,
      result, // 现在result是字符串而非JSON对象
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[ASSIST] Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      errorCode: error.code,
    });
  }
});

app.listen(PORT, () => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`LLM Proxy Server running on http://localhost:${PORT}`);
  console.log(`API Provider: ${process.env.LLM_PROVIDER || 'deepseek'}`);
  console.log(`API configured: ${hasValidConfig() ? '✓ YES' : '✗ NO'}`);
  console.log(`${'='.repeat(50)}\n`);
  console.log(`📋 测试 API 配置:\n   curl http://localhost:${PORT}/api/test`);
  console.log(`🧪 测试 LLM 调用:\n   curl -X POST http://localhost:${PORT}/api/test-llm`);
  console.log(`❤️  健康检查:\n   curl http://localhost:${PORT}/api/health\n`);
});
