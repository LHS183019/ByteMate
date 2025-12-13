console.log('[Background] Service Worker started');

// 存储键定义
const STORAGE_KEYS = {
  MODEL: 'bytemate_model',
  API_KEY: 'bytemate_api_key'
};

// LLM 提供商配置
const PROVIDER_CONFIG = {
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat'
  },
  qwen: {
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus'
  },
  zhipu: {
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4'
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4'
  },
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama3-70b-8192'
  }
};

// 题目缓存存储（内存缓存）
const problemCache = new Map();

// 全局配置对象（缓存最新配置）
let appConfig = {
  model: null,
  apiKey: null
};

// 记录最后一次复制代码的时间
let lastCopyTime = 0;

// 默认配置（内置 Key）
// ⚠️ 注意：在客户端代码中硬编码 API Key 存在安全风险。
// 建议仅在内部测试或受信任环境中使用。
const DEFAULT_CONFIG = {
  model: 'deepseek',
  apiKey: 'sk-6d4827bdba1d40e79d5bb45978e220a2' // TODO: 请在此处填入您的默认 API Key
};

// 工具函数：从local storage获取值
function getFromStorage(key) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([key], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result[key]);
      }
    });
  });
}

// 初始化配置
async function initializeConfig() {
  try {
    // 从local storage加载配置
    const storedModel = await getFromStorage(STORAGE_KEYS.MODEL);
    const storedApiKey = await getFromStorage(STORAGE_KEYS.API_KEY);

    // 使用存储的配置，如果不存在则使用默认配置
    appConfig.model = storedModel || DEFAULT_CONFIG.model;
    appConfig.apiKey = storedApiKey || DEFAULT_CONFIG.apiKey;
    
    console.log('[Background] 配置初始化完成:', {
      model: appConfig.model,
      usingDefaultKey: !storedApiKey,
      hasApiKey: !!appConfig.apiKey
    });
  } catch (error) {
    console.error('[Background] 配置初始化失败:', error);
  }
}

// 生成 Prompt
function generatePrompt(context) {
  const {
    feature,
    title,
    statement,
    currentCode,
    samples,
    customPrompt,
    error
  } = context;

  let basePrompt = customPrompt || `你是一个编程教师。\n`;
  const SEPARATOR = '__NEXT_STEP__';

  if (feature === 'guide') {
    basePrompt = `你是一个循循善诱、温柔亲切的编程教师。请按照以下四个步骤逐步引导用户解决问题。
**重要要求：**
1. **语气必须温柔、和善**（例如使用“请试着”、“别着急”等）。
2. **保持回答精简**。
3. 每一步之间 **必须** 使用 "${SEPARATOR}" (包含换行) 分隔。
4. **必须** 输出每一步的标题（如 ## 启发引导），标题使用二级标题格式。
5. 如果用户已经写了部分代码，请结合代码进度进行引导。
6. **涉及代码时，默认使用 C++**。

## 启发引导
- 仅提供 **1-2句** 简短的启发式引导。
- **绝对不要** 提供代码或具体的算法名称。
- 用温柔的反问句引导思考。

${SEPARATOR}

## 核心概念
- 仅列出核心数据结构和算法名称。
- 对关键词（如**动态规划**）进行加粗。
- **不要** 输出代码。

${SEPARATOR}

## 算法流程
- 使用清晰的步骤列表（1. 2. 3.）。
- 仅描述逻辑，**不要** 输出代码。

${SEPARATOR}

## 参考代码
- 提供完整的 C++ 代码。
- 包含关键注释。

请严格按照上述格式输出，确保包含标题和分隔符。`;
  } else if (['hint', 'idea'].includes(feature)) {
    basePrompt = `你是一个温柔、耐心的编程顾问。用户正在编写代码，需要你的鼓励和指引。
**重要要求：**
1. **语气必须温柔、和善、充满鼓励**（例如“你做得很好”、“试着想一想”）。
2. **必须基于用户当前代码**进行分析。如果代码为空，则提供起步思路。
3. **保持回答精简但有温度**。
4. 两部分之间 **必须** 使用 "${SEPARATOR}" (包含换行) 分隔。
5. **必须** 输出每部分的标题（使用二级标题格式）。
6. **涉及代码时，默认使用 C++**。

## 下一步建议
- 用温柔的语气分析当前代码逻辑到了哪一步。
- **明确指出**下一步应该实现什么功能，给出一个小目标。
- 限制在 3-5 句话以内。

${SEPARATOR}

## 详细解析
- 详细解释为什么要这样做，原理是什么。
- 提供下一步逻辑的伪代码或关键代码片段（不要直接给出完整答案，除非用户代码已接近完成）。
- 再次给予鼓励。

请严格按照上述格式输出，确保包含标题和分隔符。`;
  } else if (feature === 'fix') {
    basePrompt = `你是一个贴心的代码审查伙伴。用户代码运行出错，需要你的帮助。
**重要要求：**
1. **语气必须温柔、体贴**，不要让用户感到挫败。
2. **必须基于用户当前代码和错误信息**进行分析。
3. 两部分之间 **必须** 使用 "${SEPARATOR}" (包含换行) 分隔。
4. **必须** 输出每部分的标题（使用二级标题格式）。
5. **涉及代码时，默认使用 C++**。

## 错误诊断
- 用温和的方式指出代码中的主要问题。
- 对错误原因进行**加粗**。
- 限制在 3-5 句话以内。

${SEPARATOR}

## 修复方案
- 详细解释错误原因，帮助用户理解。
- 提供修复后的关键代码段或完整代码。
- 鼓励用户继续尝试。

请严格按照上述格式输出，确保包含标题和分隔符。`;
  }

  let fullPrompt = `${basePrompt}

题目标题: ${title}
题目描述: ${statement}

当前用户代码:
\`\`\`cpp
${currentCode || '// 用户还未提交代码'}
\`\`\`

示例:
${samples ? samples.map((s, i) => `示例${i + 1}:\n输入: ${s.input}\n输出: ${s.output}`).join('\n') : '无'}
`;

  if (error) {
    fullPrompt += `\n\n错误状态/信息:\n${error}\n`;
  }

  fullPrompt += `\n请直接回复分析结果。`;
  return fullPrompt;
}

// 获取 LLM 配置
function getLLMConfig() {
  const providerMap = {
    'OpenAI GPT-4': 'openai',
    'DeepSeek': 'deepseek',
    'Zhipu (智谱)': 'zhipu',
    'Qwen (通义千问)': 'qwen',
    'Groq': 'groq'
  };
  
  const normalizedProvider = providerMap[appConfig.model] || 'deepseek';
  const config = PROVIDER_CONFIG[normalizedProvider];
  
  return {
    ...config,
    apiKey: appConfig.apiKey
  };
}

// 初始化配置
initializeConfig();

// 监听来自 content-script 和 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Background] Received message:', request.action);
  
  // 处理来自 popup 的配置更新消息
  if (request.action === 'update_config') {
    const { config } = request;
    console.log('[Background] 收到配置更新:', config);
    
    // 更新内存中的配置
    if (config.model) {
      appConfig.model = config.model;
    }
    
    // 重新初始化配置以获取最新的API密钥
    initializeConfig()
      .then(() => {
        sendResponse({ ok: true, message: '配置已更新' });
      })
      .catch(error => {
        console.error('配置更新失败:', error);
        sendResponse({ ok: false, error: error.message });
      });
    
    return true;
  }

  if(request.action === 'submit-result') {
    const {data} = request;
    const {result, praticeId, submitTime} = data;
    console.log(`[Background] result: ${result}, praticeId: ${praticeId}, submitTime: ${submitTime}`);
    
    // 发送提交结果遥测
    // 检查是否是“复制后提交”（例如 10 分钟内）
    const isCopied = (Date.now() - lastCopyTime) < 10 * 60 * 1000;
    
    sendTelemetryEvent('code_submission', {
      result: result,
      problem_id: praticeId,
      is_copied: isCopied ? 'yes' : 'no',
      time_since_copy: isCopied ? Math.round((Date.now() - lastCopyTime) / 1000) : -1
    });

    chrome.storage.local.get((storageData) => {
      let problemStats = storageData.problemStats || {};
      if(praticeId in problemStats) {
        console.log(`${praticeId} previous result: ${problemStats[praticeId].accepted}`);
        if(!problemStats[praticeId].accepted && result === "Accepted") {
          problemStats[praticeId].accepted = true;
        }
      } else {
        problemStats[praticeId] = {
          "accepted": result === "Accepted"
        };
      }
      chrome.storage.local.set({problemStats}, () => {
        chrome.runtime.sendMessage({
          action: "update-problem-stats"
        });
      });
    })
  }

  if (request.action === 'cache_problem') {
    // 缓存题目信息
    const { path, data } = request;
    if (path && data) {
      problemCache.set(path, {
        ts: Date.now(),
        data,
      });
      console.log('[Background] Cached problem at path:', path);
      sendResponse({ ok: true });
    }
    return true;
  }

  if (request.action === 'get_cached_problem') {
    // 获取缓存的题目信息
    const { path } = request;
    if (path && problemCache.has(path)) {
      const cached = problemCache.get(path);
      console.log('[Background] Returning cached problem for path:', path);
      sendResponse({
        ok: true,
        path,
        data: cached.data,
      });
    } else {
      console.log('[Background] No cache for path:', path);
      sendResponse({ ok: false });
    }
    return true;
  }

  if (request.action === 'invoke_feature') {
    // 调用 AI 功能
    const { feature, context_json } = request;
    console.log('[Background] Invoking feature:', feature);

    try {
      const context = JSON.parse(context_json);
      invokeAIFeature(feature, context, sendResponse);
    } catch (error) {
      console.error('[Background] Failed to parse context:', error);
      sendResponse({
        success: false,
        error: '上下文解析失败',
      });
    }
    return true; // 异步响应
  }

  // 记录题目完成
  if (request.action === 'record_problem_solved') {
    const { problemId, timestamp } = request;
    recordProblemSolved(problemId, timestamp)
      .then(() => {
        sendResponse({ ok: true });
      })
      .catch(error => {
        console.error('[Background] 记录题目完成失败:', error);
        sendResponse({ ok: false, error: error.message });
      });
    return true; // 异步响应
  }

  // 记录题目尝试
  if (request.action === 'record_attempt') {
    const { problemId, timestamp } = request;
    recordAttempt(problemId, timestamp)
      .then(() => {
        sendResponse({ ok: true });
      })
      .catch(error => {
        console.error('[Background] 记录题目尝试失败:', error);
        sendResponse({ ok: false, error: error.message });
      });
    return true; // 异步响应
  }

  // 记录学习时长
  if (request.action === 'record_learning_time') {
    const { duration, timestamp } = request;
    recordLearningTime(duration, timestamp)
      .then(() => {
        sendResponse({ ok: true });
      })
      .catch(error => {
        console.error('[Background] 记录学习时长失败:', error);
        sendResponse({ ok: false, error: error.message });
      });
    return true; // 异步响应
  }

  // 从 popup 打开扩展内页面（Dashboard）
  if (request.action === 'open_url') {
    const { url } = request || {};
    try {
      if (!url) {
        sendResponse({ ok: false, error: '缺少 URL' });
        return true;
      }
      chrome.tabs.create({ url }, () => {
        if (chrome.runtime.lastError) {
          sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ ok: true });
        }
      });
    } catch (e) {
      sendResponse({ ok: false, error: e?.message || '无法打开页面' });
    }
    return true;
  }

  // 测试ping消息（用于诊断）
  if (request.action === 'test_ping') {
    sendResponse({ 
      ok: true, 
      message: 'pong', 
      timestamp: Date.now(),
      extensionId: chrome.runtime.id
    });
    return true;
  }

  if (request.action === 'send_feedback') {
    const { feature, reason } = request.data || {};
    console.log('[Background] 收到用户反馈:', feature, reason);
    
    sendTelemetryEvent('user_feedback', {
      feature: feature || 'unknown',
      reason: reason,
      timestamp: Date.now()
    });
    
    sendResponse({ ok: true });
    return true;
  }

  if (request.action === 'copy_code') {
    lastCopyTime = Date.now();
    const { length } = request.data || {};
    console.log('[Background] User copied code, length:', length);
    
    sendTelemetryEvent('code_copy', {
      length: length || 0
    });
    return true;
  }

  sendResponse({ ok: false, error: 'Unknown action' });
});

/**
 * 调用 AI 功能
 */
async function invokeAIFeature(feature, context, sendResponse) {
  try {
    // 确保使用最新的配置
    await initializeConfig();
    
    console.log('[AI-Feature] Starting:', feature);

    // 检查配置
    if (!appConfig.apiKey) {
      throw new Error('未配置 API Key');
    }
    
    if (!appConfig.model) {
      throw new Error('未选择模型');
    }

    const llmConfig = getLLMConfig();
    const prompt = generatePrompt({ ...context, feature });
    
    // 记录开始时间用于计算延迟
    context.startTime = Date.now();
    
    // 发送开始遥测
    sendTelemetryEvent('ai_feature_start', {
      feature: feature,
      model: appConfig.model
    });
    
    console.log('[AI-Feature] Sending request to LLM Provider:', llmConfig.baseUrl);

    const response = await fetch(`${llmConfig.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${llmConfig.apiKey}`
      },
      body: JSON.stringify({
        model: llmConfig.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6,
        max_tokens: 3000
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 401) {
        throw new Error('API Key 无效或已过期，请在设置中检查您的 API Key。');
      }
      throw new Error(errorData.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const result = data.choices[0]?.message?.content || '';

    console.log('[AI-Feature] Success');

    // 发送成功遥测
    sendTelemetryEvent('ai_feature_success', {
      feature: feature,
      model: appConfig.model,
      latency: Date.now() - (context.startTime || Date.now())
    });

    // 返回结果给 content-script
    sendResponse({
      success: true,
      feature,
      result: result,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[AI-Feature] Error:', error.message);
    
    // 发送失败遥测
    sendTelemetryEvent('ai_feature_error', {
      feature: feature,
      model: appConfig.model,
      error_type: error.message.includes('API Key') ? 'auth_error' : 'api_error',
      error_message: error.message.substring(0, 100)
    });

    sendResponse({
      success: false,
      error: error.message,
      feature,
    });
  }
}

// 监听长连接
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'ai-stream') return;

  console.log('[Background] Stream connected');

  port.onMessage.addListener(async (msg) => {
    if (msg.action === 'invoke_feature_stream') {
      let context = msg.context;
      if (msg.context_json && !context) {
        try {
          context = JSON.parse(msg.context_json);
        } catch (e) {
          console.error('[Background] Failed to parse context_json', e);
          port.postMessage({ type: 'error', error: 'Context parsing failed' });
          return;
        }
      }
      
      try {
        await invokeAIFeatureStream(context, port);
      } catch (error) {
        port.postMessage({ type: 'error', error: error.message });
      }
    }
  });
});

/**
 * 流式调用 AI 功能
 */
async function invokeAIFeatureStream(context, port) {
  try {
    console.log('[AI-Stream] Starting:', context.feature);
    
    // 确保使用最新的配置
    await initializeConfig();

    if (!appConfig.apiKey) throw new Error('未配置 API Key');
    if (!appConfig.model) throw new Error('未选择模型');

    const llmConfig = getLLMConfig();
    const prompt = generatePrompt(context);

    const response = await fetch(`${llmConfig.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${llmConfig.apiKey}`
      },
      body: JSON.stringify({
        model: llmConfig.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6,
        max_tokens: 3000,
        stream: true
      })
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('API Key 无效或已过期，请在设置中检查您的 API Key。');
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        port.postMessage({ type: 'done' });
        break;
      }

      const text = decoder.decode(value);
      const lines = text.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') {
            port.postMessage({ type: 'done' });
            break;
          }
          try {
            const data = JSON.parse(jsonStr);
            const content = data.choices[0]?.delta?.content;
            if (content) {
              port.postMessage({ type: 'chunk', data: content });
            }
          } catch (e) {
            // ignore parse error
          }
        }
      }
    }
  } catch (error) {
    console.error('[AI-Stream] Error:', error);
    port.postMessage({ type: 'error', error: error.message });
  }
}

/**
 * 记录题目完成
 */
async function recordProblemSolved(problemId, timestamp) {
  try {
    // 获取今日统计
    const today = new Date().toISOString().split('T')[0];
    const todayKey = `oj_daily_stats_${today}`;
    
    // 从storage获取今日统计
    const result = await new Promise((resolve) => {
      chrome.storage.local.get([todayKey], resolve);
    });
    
    const todayStats = result[todayKey] || {
      date: today,
      completedCount: 0,
      duration: 0,
      tagsLearned: [],
      startTime: timestamp,
    };
    
    // 增加完成题目数
    todayStats.completedCount += 1;
    
    // 保存更新后的统计
    await new Promise((resolve) => {
      chrome.storage.local.set({ [todayKey]: todayStats }, resolve);
    });
    
    // 更新题目记录
    const problemsKey = 'oj_problems_solved';
    const problemsResult = await new Promise((resolve) => {
      chrome.storage.local.get([problemsKey], resolve);
    });
    
    const problemsSolved = problemsResult[problemsKey] || [];
    if (!problemsSolved.includes(problemId)) {
      problemsSolved.push(problemId);
      await new Promise((resolve) => {
        chrome.storage.local.set({ [problemsKey]: problemsSolved }, resolve);
      });
    }
    
    // 保存题目详情
    const problemDetailKey = `oj_problem_details_${problemId}`;
    const problemDetail = {
      id: problemId,
      title: `题目 ${problemId}`,
      status: 'ac',
      tags: [],
      solvedAt: timestamp,
    };
    
    await new Promise((resolve) => {
      chrome.storage.local.set({ [problemDetailKey]: problemDetail }, resolve);
    });
    
    console.log('[Background] 题目完成记录成功:', problemId);
  } catch (error) {
    console.error('[Background] 记录题目完成失败:', error);
    throw error;
  }
}

/**
 * 记录题目尝试
 */
async function recordAttempt(problemId, timestamp) {
  try {
    // 这里可以记录尝试次数等信息
    console.log('[Background] 记录题目尝试:', problemId);
  } catch (error) {
    console.error('[Background] 记录题目尝试失败:', error);
    throw error;
  }
}

/**
 * 记录学习时长
 */
async function recordLearningTime(duration, timestamp) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const todayKey = `oj_daily_stats_${today}`;
    
    // 从storage获取今日统计
    const result = await new Promise((resolve) => {
      chrome.storage.local.get([todayKey], resolve);
    });
    
    const todayStats = result[todayKey] || {
      date: today,
      completedCount: 0,
      duration: 0,
      tagsLearned: [],
      startTime: timestamp,
    };
    
    // 累加学习时长
    todayStats.duration += duration;
    
    // 保存更新后的统计
    await new Promise((resolve) => {
      chrome.storage.local.set({ [todayKey]: todayStats }, resolve);
    });
    
    console.log('[Background] 学习时长记录成功:', duration, '秒');
  } catch (error) {
    console.error('[Background] 记录学习时长失败:', error);
    throw error;
  }
}

/**
 * 定期清理过期缓存（24小时）
 */
setInterval(() => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24小时

  for (const [path, cached] of problemCache.entries()) {
    if (now - cached.ts > maxAge) {
      problemCache.delete(path);
      console.log('[Background] Cleaned up expired cache for path:', path);
    }
  }
}, 60 * 60 * 1000); // 每小时检查一次

// ============ 遥测 (Telemetry) 配置 ============
// 使用 Google Analytics 4 Measurement Protocol
const GA_ENDPOINT = 'https://www.google-analytics.com/mp/collect';
const GA_MEASUREMENT_ID = 'G-KVX34E0R5J'; // TODO: 替换为您的 GA4 Measurement ID
const GA_API_SECRET = 'Uf8UWKvESna2dkZjXjVk9A';       // TODO: 替换为您的 GA4 API Secret
const DEFAULT_CLIENT_ID = 'anonymous_user';

// 获取或生成客户端 ID
async function getClientId() {
  try {
    const result = await chrome.storage.local.get('client_id');
    if (result.client_id) {
      return result.client_id;
    } else {
      const newId = crypto.randomUUID();
      await chrome.storage.local.set({ client_id: newId });
      return newId;
    }
  } catch (e) {
    return DEFAULT_CLIENT_ID;
  }
}

// 发送遥测事件
async function sendTelemetryEvent(eventName, params = {}) {
  try {
    // 如果没有配置 ID，则跳过（开发模式）
    if (GA_MEASUREMENT_ID === 'G-XXXXXXXXXX') return;

    const clientId = await getClientId();
    
    const payload = {
      client_id: clientId,
      events: [{
        name: eventName,
        params: {
          ...params,
          session_id: Date.now().toString(), // 简单会话 ID
          engagement_time_msec: 100
        }
      }]
    };

    await fetch(`${GA_ENDPOINT}?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${GA_API_SECRET}`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  } catch (error) {
    // 遥测失败不应影响主功能，仅打印日志
    console.warn('[Telemetry] Failed to send event:', error);
  }
}
