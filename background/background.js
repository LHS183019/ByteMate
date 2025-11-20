console.log('[Background] Service Worker started');

// 题目缓存存储（内存缓存）
const problemCache = new Map();

// 监听来自 content-script 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Background] Received message:', request.action);

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

  sendResponse({ ok: false, error: 'Unknown action' });
});

/**
 * 调用 AI 功能
 */
async function invokeAIFeature(feature, context, sendResponse) {
  try {
    console.log('[AI-Feature] Starting:', feature);
    console.log('[AI-Feature] Context:', {
      feature: context.feature,
      pageType: context.pageType,
      title: context.title,
      codeLength: context.currentCode.length,
    });

    // 构造请求体
    const payload = {
      feature: context.feature,
      title: context.title,
      statement: context.statement,
      currentCode: context.currentCode,
      samples: context.samples,
      problemId: context.problemId,
      error: context.error || '',
    };

    // 根据 feature 类型调用不同的后端端点
    const backendUrl = 'http://localhost:3000/api/assist';

    console.log('[AI-Feature] Sending request to:', backendUrl);

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('[AI-Feature] Response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const result = await response.json();
    console.log('[AI-Feature] Success:', {
      success: result.success,
      feature: result.feature,
      resultType: typeof result.result,
    });

    // 返回结果给 content-script
    sendResponse({
      success: true,
      feature,
      result: result.result,
      timestamp: result.timestamp,
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
