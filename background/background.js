console.log('[Background] Service Worker started');

// 存储键定义
const STORAGE_KEYS = {
  MODEL: 'bytemate_model',
  API_KEY: 'bytemate_api_key',
  TARGET_LANGUAGE: 'bytemate_target_language'
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
  apiKey: null,
  targetLanguage: 'cpp'
};

// 记录最后一次复制代码的时间
// let lastCopyTime = 0; // 移至 storage 存储，避免 Service Worker 休眠导致数据丢失

// 默认配置（内置 Key）
// ⚠️ 注意：在客户端代码中硬编码 API Key 存在安全风险。
// 建议仅在内部测试或受信任环境中使用。
const DEFAULT_CONFIG = {
  model: 'deepseek',
  apiKey: '', // 默认不提供API Key，让用户自己配置
  targetLanguage: 'cpp'
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
    const storedTargetLanguage = await getFromStorage(STORAGE_KEYS.TARGET_LANGUAGE);

    // 使用存储的配置，如果不存在则使用默认配置
    appConfig.model = storedModel || DEFAULT_CONFIG.model;
    appConfig.apiKey = storedApiKey || DEFAULT_CONFIG.apiKey;
    appConfig.targetLanguage = storedTargetLanguage || DEFAULT_CONFIG.targetLanguage;
    
    console.log('[Background] 配置初始化完成:', {
      model: appConfig.model,
      apiKey: appConfig.apiKey ? '******' + appConfig.apiKey.slice(-4) : null,
      targetLanguage: appConfig.targetLanguage,
      storedModel,
      storedApiKey: storedApiKey ? '******' + storedApiKey.slice(-4) : null,
      usingDefaultKey: !storedApiKey,
      hasApiKey: !!appConfig.apiKey
    });
  } catch (error) {
    console.error('[Background] 配置初始化失败:', error);
  }
}

// 加载 Prompt 模板
async function loadPromptTemplate(featureKey) {
  try {
    const fileMap = {
      'guide': 'guide.txt',
      'hint': 'idea.txt',
      'idea': 'idea.txt',
      'fix': 'code_fix.txt',
      'recommend': 'knowledge_tag.txt',
      'knowledge_tag': 'knowledge_tag.txt'
    };
    const filename = fileMap[featureKey];
    if (!filename) return null;
    
    const url = chrome.runtime.getURL(`prompts/${filename}`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load prompt: ${filename}`);
    return await response.text();
  } catch (e) {
    console.error('[Background] Failed to load prompt:', e);
    return null;
  }
}

// 生成 Prompt
async function generatePrompt(context) {
  console.log('[Background] generatePrompt called with context:', context);
  
  const {
    feature,
    title,
    statement,
    inputDescription,
    outputDescription,
    hint,
    currentCode,
    samples,
    customPrompt,
    error,
    feedbackReason // 新增：用户反馈原因
  } = context;

  const SEPARATOR = '__NEXT_STEP__';

  // 如果存在反馈原因，添加特定的指令
  let feedbackInstruction = '';
  if (feedbackReason) {
    const reasonMap = {
      'code_error': '用户反馈之前的代码有错误或无法运行。请仔细检查代码逻辑，修复潜在的 Bug，并给出正确的代码。',
      'bad_hint': '用户反馈之前的提示不够清晰或没有帮助。请尝试换一个角度进行解释，提供更直观的思路。',
      'too_long': '用户反馈之前的回答太长了。请务必精简内容，只保留最核心的信息。',
      'too_short': '用户反馈之前的回答太短了。请补充更多细节，详细解释原理和步骤。'
    };
    const instruction = reasonMap[feedbackReason] || '用户对之前的回答不满意，请尝试改进。';
    feedbackInstruction = `\n\n**特别注意：${instruction}**\n\n`;
  }

  // 加载基础 Prompt 模板
  let basePrompt = customPrompt;
  if (!basePrompt) {
    basePrompt = await loadPromptTemplate(feature) || `你是一个编程教师。\n`;
  }

  // 添加反馈指令
  if (feedbackInstruction && basePrompt) {
    // 在模板开头的描述部分添加反馈指令
    // 匹配两种格式：有换行符和没有换行符的情况
    const regex = /^(\s*[\s\S]+?)(\n?\*\*重要要求\*\*[:：])/s;
    if (regex.test(basePrompt)) {
      basePrompt = basePrompt.replace(regex, `$1${feedbackInstruction}$2`);
    } else {
      // 如果没有找到**重要要求**标记，直接在模板开头添加反馈指令
      basePrompt = feedbackInstruction + basePrompt;
    }
  }

  let fullPrompt = `${basePrompt}\n\n`;

  if (context.userQuery) {
    fullPrompt += `=== 用户个性化需求 (请优先关注) ===\n${context.userQuery}\n\n`;
  }

  fullPrompt += `=== 当前页面上下文 (仅供参考，如无关请忽略) ===
题目标题: ${title}
题目描述: ${statement}
输入描述: ${inputDescription || '无'}
输出描述: ${outputDescription || '无'}
提示: ${hint || '无'}

当前用户代码:
\`\`\`${appConfig.targetLanguage || 'cpp'}
${currentCode || '// 用户还未提交代码'}
\`\`\`

示例:
${samples ? samples.map((s, i) => `示例${i + 1}:\n输入: ${s.input}\n输出: ${s.output}`).join('\n') : '无'}
`;

  if (error) {
    fullPrompt += `\n\n错误状态/信息:\n${error}\n`;
  }

  fullPrompt += `\n请直接回复分析结果。请使用 ${appConfig.targetLanguage || 'cpp'} 语言生成代码。`;
  console.log('[Background] Generated full prompt:', fullPrompt);
  return fullPrompt;
}

// 获取 LLM 配置
function getLLMConfig() {
  // 如果模型名称直接存在于配置中，直接使用
  if (PROVIDER_CONFIG[appConfig.model]) {
    return {
      ...PROVIDER_CONFIG[appConfig.model],
      apiKey: appConfig.apiKey
    };
  }

  // 兼容旧版配置（使用显示名称的情况）
  const providerMap = {
    'OpenAI GPT-4': 'openai',
    'DeepSeek': 'deepseek',
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
    if (config.targetLanguage) {
      appConfig.targetLanguage = config.targetLanguage;
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

  // 处理用户反馈消息
  if (request.action === 'submit_feedback') {
    const { text } = request;
    console.log('[Background] 收到用户反馈:', text);
    
    sendTelemetryEvent('general_feedback', {
      feedback_text: text
    }).then(() => {
      sendResponse({ ok: true });
    }).catch(error => {
      console.error('发送反馈遥测失败:', error);
      sendResponse({ ok: false, error: error.message });
    });
    
    return true;
  }

  if(request.action === 'submit-result') {
    const {data} = request;
    console.log('[Background] Received submit-result message:', JSON.stringify(data));
    const {result, praticeId, submitTime} = data;
    
    // 发送提交结果遥测
    // 从 storage 获取最后一次复制代码的时间
    chrome.storage.local.get(['lastCopyTime'], (storageResult) => {
      const lastCopyTime = storageResult.lastCopyTime || 0;
      console.log('[Background] Retrieved lastCopyTime:', lastCopyTime);
      
      // 检查是否是“复制后提交”（例如 10 分钟内）
      const isCopied = (Date.now() - lastCopyTime) < 10 * 60 * 1000;
      console.log('[Background] isCopied:', isCopied, 'Time since copy:', (Date.now() - lastCopyTime) / 1000);
      
      sendTelemetryEvent('code_submission', {
        result: result,
        problem_id: praticeId,
        is_copied: isCopied ? 'yes' : 'no',
        time_since_copy: isCopied ? Math.round((Date.now() - lastCopyTime) / 1000) : -1
      });
    });

    // 如果是 Accepted，记录到每日统计
    // 宽松匹配：包含 "Accept", "AC", "正确" 均视为通过
    const isAccepted = result === 'Accepted' || 
                       result.includes('Accept') || 
                       result === 'AC' || 
                       result.includes('正确');

    if (isAccepted) {
      recordProblemSolved(praticeId, Date.now()).catch(err => {
        console.error('[Background] Failed to record problem solved from submit-result:', err);
      });
    }

    chrome.storage.local.get((storageData) => {
      let problemStats = storageData.problemStats || {};
      if(praticeId in problemStats) {
        console.log(`${praticeId} previous result: ${problemStats[praticeId].accepted}`);
        if(!problemStats[praticeId].accepted && isAccepted) {
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
    const now = Date.now();
    chrome.storage.local.set({ lastCopyTime: now });
    
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
    if (!appConfig.apiKey || !appConfig.model) {
      // 即使API未配置，也要生成prompt以便用户复制
      const prompt = await generatePrompt({ ...context, feature });
      if (!appConfig.apiKey) {
        throw new Error(`未配置 API Key|||${prompt}`);
      } else {
        throw new Error(`未选择模型|||${prompt}`);
      }
    }

    const llmConfig = getLLMConfig();
    const prompt = await generatePrompt({ ...context, feature });
    
    // 记录开始时间用于计算延迟
    context.startTime = Date.now();
    
    // 发送开始遥测
    sendTelemetryEvent('ai_feature_start', {
      feature: feature,
      model: appConfig.model
    });
    
    console.log('[AI-Feature] Sending request to LLM Provider:', llmConfig.baseUrl);
    console.log('[AI-Feature] Final Prompt:', prompt);
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
  const startTime = Date.now();
  try {
    console.log('[AI-Stream] Starting:', context.feature);
    
    // 确保使用最新的配置
    await initializeConfig();

    if (!appConfig.apiKey || !appConfig.model) {
      // 即使API未配置，也要生成prompt以便用户复制
      const prompt = await generatePrompt(context);
      if (!appConfig.apiKey) {
        throw new Error(`未配置 API Key|||${prompt}`);
      } else {
        throw new Error(`未选择模型|||${prompt}`);
      }
    }

    const llmConfig = getLLMConfig();
    const prompt = await generatePrompt(context);

    // 发送开始遥测
    sendTelemetryEvent('ai_feature_start', {
      feature: context.feature,
      model: appConfig.model
    });

    console.log('[AI-Stream] Sending request to LLM Provider:', llmConfig.baseUrl);
    console.log('[AI-Stream] Final Prompt:', prompt);

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
      } else if (response.status === 403) {
        throw new Error('API 访问被拒绝，可能是权限不足或API Key错误。');
      } else if (response.status === 429) {
        throw new Error('请求过于频繁，请稍后再试。');
      } else if (response.status === 503) {
        throw new Error('服务器暂时不可用（HTTP 503），可能是服务器崩溃或维护中，请稍等片刻后再试，或尝试切换其他模型提供商。');
      } else if (response.status >= 500) {
        throw new Error(`服务器错误（HTTP ${response.status}），可能是服务器崩溃或维护中，请稍后再试。`);
      }
      throw new Error(`HTTP ${response.status} 错误，请检查网络连接或稍后再试。`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        port.postMessage({ type: 'done' });
        
        // 发送成功遥测
        sendTelemetryEvent('ai_feature_success', {
          feature: context.feature,
          model: appConfig.model,
          latency: Date.now() - startTime
        });
        break;
      }

      const text = decoder.decode(value, { stream: true });
      buffer += text;
      const lines = buffer.split('\n');
      buffer = lines.pop(); // 保留最后一个可能不完整的行

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        if (trimmedLine.startsWith('data: ')) {
          const jsonStr = trimmedLine.slice(6).trim();
          if (jsonStr === '[DONE]') {
            // 流结束标志
            continue;
          }
          try {
            const data = JSON.parse(jsonStr);
            const content = data.choices[0]?.delta?.content;
            if (content) {
              port.postMessage({ type: 'chunk', data: content });
            }
          } catch (e) {
            // 忽略解析错误（可能是非JSON数据或不完整数据）
          }
        }
      }
    }
  } catch (error) {
    console.error('[AI-Stream] Error:', error);
    port.postMessage({ type: 'error', error: error.message });
    
    // 发送失败遥测
    sendTelemetryEvent('ai_feature_error', {
      feature: context.feature,
      model: appConfig.model,
      error_type: error.message.includes('API Key') ? 'auth_error' : 'api_error',
      error_message: error.message.substring(0, 100)
    });
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
      completedProblems: [],
      duration: 0,
      tagsLearned: [],
      startTime: timestamp,
    };
    
    // 确保 completedProblems 数组存在
    if (!todayStats.completedProblems) {
      todayStats.completedProblems = [];
    }

    // 检查是否已存在
    if (problemId) {
      if (todayStats.completedProblems.includes(problemId)) {
        // 已经记录过，不重复计数
        return;
      }
      todayStats.completedProblems.push(problemId);
      todayStats.completedCount += 1;
    } else {
      // 兼容旧逻辑
      todayStats.completedCount += 1;
    }
      
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
          target_language: appConfig.targetLanguage || 'cpp',
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

// Expose functions for testing
if (typeof window !== 'undefined') {
  window.BackgroundService = {
    initializeConfig,
    getLLMConfig,
    generatePrompt,
    appConfig,
    PROVIDER_CONFIG
  };
}
