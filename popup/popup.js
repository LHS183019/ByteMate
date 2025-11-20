/**
 * Popup.js - ByteMate 右上角弹出窗口主逻辑
 * 功能：
 * 1. 模型选择和切换
 * 2. API Key 配置和保存
 * 3. 显示今日学习情况
 * 4. 打开 Dashboard 仪表板
 */

// 导入StorageManager类
import { StorageManager } from '../api/storage.js';

// ============ 存储键定义 ============
const STORAGE_KEYS = {
  MODEL: 'bytemate_model',
  API_KEY: 'bytemate_api_key',
  DAILY_STATS: 'bytemate_daily_stats',
  LAST_RESET: 'bytemate_last_reset'
};

const MODELS = {
  openai: 'OpenAI GPT-4',
  deepseek: 'DeepSeek',
  zhipu: 'Zhipu (智谱)',
  qwen: 'Qwen (通义千问)',
  groq: 'Groq'
};

// ============ DOM 元素缓存 ============
const DOM = {
  modelSelect: document.getElementById('model-select'),
  apiKeyInput: document.getElementById('api-key-input'),
  togglePasswordBtn: document.getElementById('toggle-password-btn'),
  saveBtn: document.getElementById('save-btn'),
  dashboardBtn: document.getElementById('dashboard-btn'),
  statusMessage: document.getElementById('status-message'),
  solvedCount: document.getElementById('solved-count'),
  helpedCount: document.getElementById('helped-count'),
  tagsCount: document.getElementById('tags-count'),
  helpLink: document.getElementById('help-link')
};

// ============ 初始化 ============
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Popup 已加载');
  await loadSettings();
  await loadTodayStats();
  attachEventListeners();
});

// ============ 加载设置 ============
/**
 * 从浏览器存储加载已保存的设置
 */
async function loadSettings() {
  try {
    // 设置使用local存储
    await StorageManager.setStorageType('local');
    
    // 加载模型选择
    const model = await StorageManager.getItem(STORAGE_KEYS.MODEL);
    if (model) {
      DOM.modelSelect.value = model;
    }

    // 加载 API Key
    const apiKey = await StorageManager.getItem(STORAGE_KEYS.API_KEY);
    if (apiKey) {
      DOM.apiKeyInput.value = apiKey;
    }
  } catch (error) {
    console.error('加载设置失败:', error);
  }
}

// ============ 加载今日统计 ============
/**
 * 加载并显示今日学习情况
 */
async function loadTodayStats() {
  try {
    // 设置使用local存储
    await StorageManager.setStorageType('local');
    
    const today = new Date().toISOString().split('T')[0];
    
    // 获取统计数据
    const stats = await StorageManager.getItem(STORAGE_KEYS.DAILY_STATS) || {};
    const lastReset = await StorageManager.getItem(STORAGE_KEYS.LAST_RESET);

    // 如果是新的一天，重置统计数据
    if (lastReset !== today) {
      const newStats = {
        date: today,
        solved: 0,
        helped: 0,
        tags: 0
      };
      await StorageManager.setItem(STORAGE_KEYS.DAILY_STATS, newStats);
      await StorageManager.setItem(STORAGE_KEYS.LAST_RESET, today);
      // 更新 UI
      DOM.solvedCount.textContent = 0;
      DOM.helpedCount.textContent = 0;
      DOM.tagsCount.textContent = 0;
    } else {
      // 更新 UI
      DOM.solvedCount.textContent = stats.solved || 0;
      DOM.helpedCount.textContent = stats.helped || 0;
      DOM.tagsCount.textContent = stats.tags || 0;
    }
  } catch (error) {
    console.error('加载统计数据失败:', error);
  }
}

// ============ 事件监听 ============
/**
 * 绑定所有事件监听器
 */
function attachEventListeners() {
  // 模型选择变化时实时保存
  DOM.modelSelect.addEventListener('change', async () => {
    try {
      // 设置使用local存储
      await StorageManager.setStorageType('local');
      
      const selectedModel = DOM.modelSelect.value;
      await StorageManager.setItem(STORAGE_KEYS.MODEL, selectedModel);
      console.log('模型已切换为:', selectedModel);
      showStatus('模型已切换', 'success');
    } catch (error) {
      console.error('保存模型选择失败:', error);
      showStatus('保存失败', 'error');
    }
  });

  // 密码显示/隐藏切换
  DOM.togglePasswordBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const inputType = DOM.apiKeyInput.type;
    if (inputType === 'password') {
      DOM.apiKeyInput.type = 'text';
      DOM.togglePasswordBtn.textContent = '🙈';
    } else {
      DOM.apiKeyInput.type = 'password';
      DOM.togglePasswordBtn.textContent = '👁️';
    }
  });

  // 保存设置按钮
  DOM.saveBtn.addEventListener('click', saveSettings);

  // 打开 Dashboard 按钮
  DOM.dashboardBtn.addEventListener('click', openDashboard);

  // 帮助链接
  DOM.helpLink.addEventListener('click', (e) => {
    e.preventDefault();
    showStatus('帮助功能开发中...', 'info');
  });
}

// ============ 保存设置 ============
/**
 * 保存用户设置到浏览器存储
 */
async function saveSettings() {
  const model = DOM.modelSelect.value;
  const apiKey = DOM.apiKeyInput.value.trim();

  if (!apiKey) {
    showStatus('请输入 API Key', 'error');
    return;
  }

  // 验证 API Key 长度（简单校验）
  if (apiKey.length < 10) {
    showStatus('API Key 过短，请检查输入', 'error');
    return;
  }

  try {
    // 设置使用local存储
    await StorageManager.setStorageType('local');
    
    await StorageManager.setItem(STORAGE_KEYS.MODEL, model);
    await StorageManager.setItem(STORAGE_KEYS.API_KEY, apiKey);
    
    console.log('设置已保存 - 模型:', model, '| API Key:', apiKey.substring(0, 5) + '***');
    showStatus('✓ 设置已保存', 'success');

    // 通知后台脚本配置已更新
    notifyBackgroundSettings({
      model: model,
      hasApiKey: true
    });

    // 2秒后清除提示
    setTimeout(() => {
      DOM.statusMessage.textContent = '';
      DOM.statusMessage.className = 'status-message';
    }, 2000);
  } catch (error) {
    console.error('保存设置失败:', error);
    showStatus('保存失败', 'error');
  }
}

// ============ 打开 Dashboard ============
/**
 * 打开学习进度仪表板
 */
function openDashboard() {
  const dashboardUrl = chrome.runtime.getURL('dashboard/index.html');
  chrome.runtime.sendMessage(
    { action: 'open_url', url: dashboardUrl },
    (response) => {
      if (response && response.ok) {
        console.log('已打开 Dashboard');
        showStatus('正在打开仪表板...', 'info');
      } else {
        console.error('打开 Dashboard 失败:', response);
        showStatus('打开仪表板失败', 'error');
      }
    }
  );
}

// ============ 通知后台脚本 ============
/**
 * 通知后台脚本配置已更新
 */
function notifyBackgroundSettings(config) {
  chrome.runtime.sendMessage(
    { action: 'update_config', config: config },
    (response) => {
      if (response && response.ok) {
        console.log('后台已收到配置更新');
      } else {
        console.warn('后台未响应配置更新');
      }
    }
  );
}

// ============ 显示状态提示 ============
/**
 * 显示状态提示信息
 * @param {string} message - 提示信息
 * @param {string} type - 类型 ('success', 'error', 'info', 'warning')
 */
function showStatus(message, type = 'info') {
  DOM.statusMessage.textContent = message;
  DOM.statusMessage.className = `status-message status-${type}`;
}

// ============ 工具函数 ============
/**
 * 获取当前保存的设置
 */
async function getSettings() {
  try {
    // 设置使用local存储
    await StorageManager.setStorageType('local');
    
    const model = await StorageManager.getItem(STORAGE_KEYS.MODEL);
    const apiKey = await StorageManager.getItem(STORAGE_KEYS.API_KEY);
    return {
      [STORAGE_KEYS.MODEL]: model,
      [STORAGE_KEYS.API_KEY]: apiKey
    };
  } catch (error) {
    console.error('获取设置失败:', error);
    return {};
  }
}

/**
 * 更新今日统计数据
 * @param {string} statType - 统计类型 ('solved', 'helped', 'tags')
 */
async function updateDailyStat(statType) {
  try {
    // 设置使用local存储
    await StorageManager.setStorageType('local');
    
    const today = new Date().toISOString().split('T')[0];
    
    // 获取统计数据
    let stats = await StorageManager.getItem(STORAGE_KEYS.DAILY_STATS) || {
      date: today,
      solved: 0,
      helped: 0,
      tags: 0
    };

    // 检查是否是新的一天
    const lastReset = await StorageManager.getItem(STORAGE_KEYS.LAST_RESET);
    if (lastReset !== today) {
      stats = {
        date: today,
        solved: 0,
        helped: 0,
        tags: 0
      };
    }

    // 增加指定的统计数据
    if (stats[statType] !== undefined) {
      stats[statType]++;
    }

    // 保存更新
    await StorageManager.setItem(STORAGE_KEYS.DAILY_STATS, stats);
    await StorageManager.setItem(STORAGE_KEYS.LAST_RESET, today);
    
    console.log(`统计已更新: ${statType} = ${stats[statType]}`);
  } catch (error) {
    console.error('更新统计数据失败:', error);
  }
}

// ============ 监听来自 content-script 的消息 ============
/**
 * 接收来自 content-script 的消息以更新统计数据
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'update_stat') {
    updateDailyStat(request.statType);
    // 重新加载统计数据以显示更新后的值
    loadTodayStats();
    sendResponse({ ok: true });
  }
});
