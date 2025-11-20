console.log('[Background] Service Worker started');

// 存储键定义
const STORAGE_KEYS = {
  MODEL: 'bytemate_model',
  API_KEY: 'bytemate_api_key'
};

// 题目缓存存储（内存缓存）
const problemCache = new Map();

// 全局配置对象（缓存最新配置）
let appConfig = {
  model: null,
  apiKey: null
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
    appConfig.model = await getFromStorage(STORAGE_KEYS.MODEL);
    appConfig.apiKey = await getFromStorage(STORAGE_KEYS.API_KEY);
    
    console.log('[Background] 配置初始化完成:', {
      model: appConfig.model,
      hasApiKey: !!appConfig.apiKey
    });
  } catch (error) {
    console.error('[Background] 配置初始化失败:', error);
  }
}

// 发送请求到后端API，包含用户配置
async function sendRequestToBackend(endpoint, data) {
  const backendUrl = 'http://localhost:3000';
  const url = `${backendUrl}${endpoint}`;
  
  try {
    // 确保配置已初始化
    if (!appConfig) {
      await initializeConfig();
    }
    
    // 合并用户配置到请求数据
    const requestData = {
      ...data,
      model: appConfig.model,
      apiKey: appConfig.apiKey
    };
    
    console.log('发送请求到后端:', { endpoint, model: requestData.model });
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('发送请求到后端失败:', error);
    throw error;
  }
}

// 初始化配置
initializeConfig();

// 向backend同步配置
async function syncConfigToBackend() {
  try {
    // 检查配置是否存在
    if (!appConfig || !appConfig.model) {
      console.error('配置同步失败: 配置未初始化或模型未选择');
      throw new Error('配置未初始化或模型未选择');
    }
    
    const backendUrl = 'http://localhost:3000';
    
    // 将前端模型名称转换为后端使用的格式
    const providerMap = {
      'OpenAI GPT-4': 'openai',
      'DeepSeek': 'deepseek',
      'Zhipu (智谱)': 'zhipu',
      'Qwen (通义千问)': 'qwen',
      'Groq': 'groq'
    };
    
    const normalizedProvider = providerMap[appConfig.model] || 'deepseek';
    
    // 准备更新的数据
    const configData = {
      provider: normalizedProvider,
      apiKeys: {}
    };
    
    // 只更新对应提供商的API密钥
    configData.apiKeys[normalizedProvider] = appConfig.apiKey || '';
    
    console.log('正在同步配置到backend:', {
      provider: normalizedProvider,
      backendUrl: backendUrl,
      hasApiKey: !!appConfig.apiKey
    });
    
    // 添加超时处理
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
    
    try {
      const response = await fetch(`${backendUrl}/api/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(configData),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorDetails = await response.text().catch(() => '无法获取错误详情');
        console.error(`配置同步失败: HTTP错误 ${response.status}`, errorDetails);
        throw new Error(`HTTP错误! 状态码: ${response.status} - ${errorDetails}`);
      }
      
      const result = await response.json();
      console.log('配置同步成功:', result);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        console.error('配置同步失败: 请求超时（10秒）');
        throw new Error('请求超时，请检查后端服务是否正常运行');
      }
      
      // 网络错误特殊处理
      if (!error.message.includes('HTTP')) {
        console.error('配置同步失败: 网络错误或后端服务未运行', error);
        throw new Error(`网络错误: ${error.message || '无法连接到后端服务'}`);
      }
      
      throw error;
    }
  } catch (error) {
    console.error('配置同步失败:', error);
    throw error;
  }
}

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
        // 同步配置到backend
        return syncConfigToBackend();
      })
      .then(() => {
        sendResponse({ ok: true, message: '配置已更新并同步到后端' });
      })
      .catch(error => {
        console.error('配置同步失败:', error);
        // 即使同步失败，本地配置仍已更新，返回成功
        sendResponse({ ok: true, message: '本地配置已更新，但同步到后端失败', error: error.message });
      });
    
    return true;
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
    console.log('[AI-Feature] Context:', {
      feature: context.feature,
      pageType: context.pageType,
      title: context.title,
      codeLength: context.currentCode?.length || 0,
    });

    // 检查配置
    if (!appConfig.apiKey) {
      throw new Error('未配置 API Key');
    }
    
    if (!appConfig.model) {
      throw new Error('未选择模型');
    }
    
    // 准备请求数据，确保所有必要字段都有默认值
    const requestData = {
      feature: context.feature || feature,
      title: context.title || '',
      statement: context.statement || '',
      currentCode: context.currentCode || '',
      samples: context.samples || [],
      problemId: context.problemId || '',
      error: context.error || ''
    };

    console.log('[AI-Feature] Sending request using sendRequestToBackend');

    // 使用sendRequestToBackend函数发送请求
    const result = await sendRequestToBackend('/api/assist', requestData);

    console.log('[AI-Feature] Success:', {
      success: result.success,
      feature: result.feature,
      resultType: typeof result.result,
    });

    // 返回结果给 content-script
    sendResponse({
      success: result.success,
      feature,
      result: result.result,
      timestamp: result.timestamp || Date.now(),
    });
  } catch (error) {
    console.error('[AI-Feature] Error:', error.message);
    sendResponse({
      success: false,
      error: error.message,
      feature,
    });
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
