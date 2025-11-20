const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');
require('dotenv').config();

// 创建全局配置对象，用于动态更新
const globalConfig = {
  // 从环境变量初始化配置
  llmProvider: process.env.LLM_PROVIDER || 'deepseek',
  apiKeys: {
    deepseek: process.env.DEEPSEEK_API_KEY,
    qwen: process.env.QWEN_API_KEY,
    zhipu: process.env.ZHIPU_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    groq: process.env.GROQ_API_KEY
  },
  baseUrls: {
    deepseek: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
    qwen: process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    zhipu: process.env.ZHIPU_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4',
    openai: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    groq: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1'
  },
  models: {
    deepseek: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    qwen: process.env.QWEN_MODEL || 'qwen-plus',
    zhipu: process.env.ZHIPU_MODEL || 'glm-4',
    openai: process.env.OPENAI_MODEL || 'gpt-4',
    groq: process.env.GROQ_MODEL || 'llama3-70b-8192'
  }
};

const app = express();
const PORT = process.env.PORT || 3000;

// 配置CORS以允许所有来源，特别是Chrome扩展
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
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
// 支持从全局配置或请求参数获取配置
const getLLMClient = (customConfig = {}) => {
  // 从请求参数获取配置，优先使用请求参数，其次是全局配置
  const provider = customConfig.model || globalConfig.llmProvider || 'deepseek';
  
  // 根据provider映射到对应的配置
  const providerMap = {
    'OpenAI GPT-4': 'openai',
    'DeepSeek': 'deepseek', 
    'Zhipu (智谱)': 'zhipu',
    'Qwen (通义千问)': 'qwen',
    'Groq': 'groq'
  };
  
  // 转换provider名称为后端使用的格式
  const normalizedProvider = providerMap[provider] || provider;

  // 从全局配置获取基础设置
  const apiKey = globalConfig.apiKeys[normalizedProvider];
  const baseURL = globalConfig.baseUrls[normalizedProvider];
  const model = globalConfig.models[normalizedProvider];
  
  if (!apiKey || !baseURL || !model) {
    throw new Error(`LLM 提供商 ${normalizedProvider} 未配置完整`);
  }
  
  // 创建最终配置，优先使用请求参数中的apiKey
  const finalConfig = {
    apiKey: customConfig.apiKey || apiKey,
    baseURL: baseURL,
    model: model
  };

  if (!finalConfig.apiKey) {
    throw new Error(`${normalizedProvider.toUpperCase()}_API_KEY 缺失`);
  }

  console.log(`[LLM-CLIENT] Using ${normalizedProvider} with model: ${finalConfig.model}`);
  console.log(`[LLM-CLIENT] Base URL: ${finalConfig.baseURL}`);
  console.log(`[LLM-CLIENT] API Key: ${finalConfig.apiKey.substring(0, 10)}...`);

  return new OpenAI({
    apiKey: finalConfig.apiKey,
    baseURL: finalConfig.baseURL,
  });
};

// 修改检查配置函数，支持自定义配置
const hasValidConfig = (customConfig = {}) => {
  try {
    getLLMClient(customConfig);
    return true;
  } catch (error) {
    console.error('[CONFIG-CHECK]', error.message);
    return false;
  }
};

// 移除重复的hasValidConfig定义，保留上面带参数的版本

/**
 * 测试端点 - 用于快速诊断
 */
app.get('/api/test', (req, res) => {
  const testInfo = {
    timestamp: Date.now(),
    provider: globalConfig.llmProvider,
    hasApiKey: Object.values(globalConfig.apiKeys).some(key => key),
    apiKeyLength: {
      deepseek: globalConfig.apiKeys.deepseek?.length || 0,
      qwen: globalConfig.apiKeys.qwen?.length || 0,
      zhipu: globalConfig.apiKeys.zhipu?.length || 0,
      openai: globalConfig.apiKeys.openai?.length || 0,
      groq: globalConfig.apiKeys.groq?.length || 0
    },
    baseUrl: globalConfig.baseUrls,
    models: globalConfig.models,
  };

  res.json({
    status: 'ok',
    config: testInfo,
    message: hasValidConfig()
      ? 'LLM 服务已配置'
      : 'LLM 服务未配置，请更新配置',
  });
});

/**
 * 配置更新端点 - 允许动态更新LLM配置
 */
app.post('/api/config', (req, res) => {
  try {
    const { provider, apiKeys, baseUrls, models } = req.body;
    
    // 更新提供商
    if (provider) {
      globalConfig.llmProvider = provider;
      console.log(`[CONFIG-UPDATE] Updated provider to: ${provider}`);
    }
    
    // 更新API密钥
    if (apiKeys && typeof apiKeys === 'object') {
      Object.keys(apiKeys).forEach(key => {
        if (globalConfig.apiKeys.hasOwnProperty(key)) {
          globalConfig.apiKeys[key] = apiKeys[key];
          console.log(`[CONFIG-UPDATE] Updated API key for ${key}`);
        }
      });
    }
    
    // 更新基础URL
    if (baseUrls && typeof baseUrls === 'object') {
      Object.keys(baseUrls).forEach(key => {
        if (globalConfig.baseUrls.hasOwnProperty(key)) {
          globalConfig.baseUrls[key] = baseUrls[key];
          console.log(`[CONFIG-UPDATE] Updated base URL for ${key}`);
        }
      });
    }
    
    // 更新模型
    if (models && typeof models === 'object') {
      Object.keys(models).forEach(key => {
        if (globalConfig.models.hasOwnProperty(key)) {
          globalConfig.models[key] = models[key];
          console.log(`[CONFIG-UPDATE] Updated model for ${key}`);
        }
      });
    }
    
    res.json({
      success: true,
      message: '配置更新成功',
      currentConfig: {
        provider: globalConfig.llmProvider,
        // 不返回完整的API密钥，只返回前10个字符
        apiKeysStatus: Object.keys(globalConfig.apiKeys).reduce((acc, key) => {
          acc[key] = globalConfig.apiKeys[key] ? `${globalConfig.apiKeys[key].substring(0, 10)}...` : null;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error('[CONFIG-UPDATE] Error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取当前配置端点
 */
app.get('/api/config', (req, res) => {
  res.json({
    provider: globalConfig.llmProvider,
    apiKeysStatus: Object.keys(globalConfig.apiKeys).reduce((acc, key) => {
      acc[key] = globalConfig.apiKeys[key] ? '已配置' : '未配置';
      return acc;
    }, {}),
    baseUrls: globalConfig.baseUrls,
    models: globalConfig.models,
    timestamp: Date.now()
  });
});

/**
 * 简单的 LLM 测试端点
 */
app.post('/api/test-llm', async (req, res) => {
  try {
    console.log('[TEST-LLM] Starting test...');
    
    // 从请求体获取自定义配置
    const customConfig = {
      model: req.body.model,
      apiKey: req.body.apiKey
    };

    if (!hasValidConfig(customConfig)) {
      return res.status(503).json({
        success: false,
        error: 'LLM 未配置',
        details: 'API Key 或 Base URL 缺失',
      });
    }

    const client = getLLMClient(customConfig);
    const provider = customConfig.model || process.env.LLM_PROVIDER || 'deepseek';
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
    provider: globalConfig.llmProvider,
    timestamp: Date.now(),
  });
});

/**
 * 非流式调用 LLM
 */
app.post('/api/llm', async (req, res) => {
  try {
    // 从请求体获取自定义配置
    const customConfig = {
      model: req.body.model,
      apiKey: req.body.apiKey
    };
    
    if (!hasValidConfig(customConfig)) {
      return res.status(503).json({
        error: 'LLM 服务未配置',
        success: false,
      });
    }

    const { prompt, temperature, maxTokens } = req.body;
    const client = getLLMClient(customConfig);
    const provider = customConfig.model || process.env.LLM_PROVIDER || 'deepseek';

    // 适配前端model名称到后端使用的格式
    const providerMap = {
      'OpenAI GPT-4': 'openai',
      'DeepSeek': 'deepseek', 
      'Zhipu (智谱)': 'zhipu',
      'Qwen (通义千问)': 'qwen',
      'Groq': 'groq'
    };
    const normalizedProvider = providerMap[provider] || provider;

    const configMap = {
      deepseek: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      qwen: process.env.QWEN_MODEL || 'qwen-plus',
      zhipu: process.env.ZHIPU_MODEL || 'glm-4',
      openai: process.env.OPENAI_MODEL || 'gpt-4',
      groq: process.env.GROQ_MODEL || 'llama3-70b-8192',
    };
    const selectedModel = model || configMap[normalizedProvider];

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
  try {
    // 从请求体获取自定义配置
    const customConfig = {
      model: req.body.model,
      apiKey: req.body.apiKey
    };
    
    if (!hasValidConfig(customConfig)) {
      return res.status(503).json({
        error: 'LLM 服务未配置',
        success: false,
      });
    }

    const { prompt } = req.body;
    const client = getLLMClient(customConfig);
    const provider = customConfig.model || process.env.LLM_PROVIDER || 'deepseek';

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
  // 从全局配置获取所有可用模型
  const models = {
    deepseek: { id: globalConfig.models.deepseek, name: 'DeepSeek Chat' },
    qwen: { id: globalConfig.models.qwen, name: 'Qwen Plus' },
    zhipu: { id: globalConfig.models.zhipu, name: 'ZhiPu GLM-4' },
    openai: { id: globalConfig.models.openai, name: 'OpenAI GPT-4' },
    groq: { id: globalConfig.models.groq, name: 'Groq Llama3' }
  };

  res.json({
    currentProvider: globalConfig.llmProvider,
    models: Object.keys(models).map(provider => models[provider]),
  });
});

/**
 * 处理题目问题的统一端点
 */
app.post('/api/assist', async (req, res) => {
  try {
    // 从请求体获取自定义配置
    const customConfig = {
      model: req.body.model,
      apiKey: req.body.apiKey
    };
    
    if (!hasValidConfig(customConfig)) {
      return res.status(503).json({
        error: 'LLM 服务未配置',
        success: false,
      });
    }

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

    const client = getLLMClient(customConfig);
    const provider = customConfig.model || process.env.LLM_PROVIDER || 'deepseek';

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
  console.log(`API Provider: ${globalConfig.llmProvider}`);
  console.log(`API configured: ${hasValidConfig() ? '✓ YES' : '✗ NO'}`);
  console.log(`${'='.repeat(50)}\n`);
  console.log(`⚙️  动态配置更新:
   POST http://localhost:${PORT}/api/config`);
  console.log(`📊 查看当前配置:
   GET http://localhost:${PORT}/api/config\n`);
  console.log(`📋 测试 API 配置:\n   curl http://localhost:${PORT}/api/test`);
  console.log(`🧪 测试 LLM 调用:\n   curl -X POST http://localhost:${PORT}/api/test-llm`);
  console.log(`❤️  健康检查:\n   curl http://localhost:${PORT}/api/health\n`);
});
