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
  TARGET_LANGUAGE: 'bytemate_target_language'
};

const MODELS = {
  deepseek: 'DeepSeek',
  qwen: 'Qwen (通义千问)'
};

// ============ DOM 元素缓存 ============
export let DOM = {};

export function initDOM() {
  DOM = {
    modelSelect: document.getElementById('model-select'),
    languageSelect: document.getElementById('language-select'),
    apiKeyInput: document.getElementById('api-key-input'),
    togglePasswordBtn: document.getElementById('toggle-password-btn'),
    saveBtn: document.getElementById('save-btn'),
    dashboardBtn: document.getElementById('dashboard-btn'),
    problemsetBtn: document.getElementById('problemset-btn'),
    statusMessage: document.getElementById('status-message'),
    helpLink: document.getElementById('help-link')
  };
}

// ============ 初始化 ============
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Popup 已加载');
  initDOM();
  await loadSettings();
  attachEventListeners();
});

// ============ 加载设置 ============
/**
 * 从浏览器存储加载已保存的设置
 */
export async function loadSettings() {
  try {
    // 设置使用local存储
    await StorageManager.setStorageType('local');
    
    // 加载模型选择
    const model = await StorageManager.getItem(STORAGE_KEYS.MODEL);
    if (model) {
      DOM.modelSelect.value = model;
    }

    // 加载目标语言
    const targetLanguage = await StorageManager.getItem(STORAGE_KEYS.TARGET_LANGUAGE);
    if (targetLanguage) {
      DOM.languageSelect.value = targetLanguage;
    } else {
      DOM.languageSelect.value = 'cpp'; // 默认 C++
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

// ============ 事件监听 ============
/**
 * 绑定所有事件监听器
 */
export function attachEventListeners() {
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

  // 语言选择变化时实时保存
  DOM.languageSelect.addEventListener('change', async () => {
    try {
      await StorageManager.setStorageType('local');
      const selectedLanguage = DOM.languageSelect.value;
      await StorageManager.setItem(STORAGE_KEYS.TARGET_LANGUAGE, selectedLanguage);
      console.log('目标语言已切换为:', selectedLanguage);
      showStatus('目标语言已切换', 'success');
      
      // 通知 background 更新配置
      chrome.runtime.sendMessage({ 
        action: 'update_config', 
        config: { targetLanguage: selectedLanguage } 
      });
    } catch (error) {
      console.error('保存目标语言失败:', error);
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

  // 打开题库
  DOM.problemsetBtn.addEventListener('click', openProblemSet);

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

  // 验证 API Key 长度（如果用户输入了 Key）
  if (apiKey && apiKey.length < 10) {
    showStatus('API Key 过短，请检查输入', 'error');
    return;
  }

  try {
    // 设置使用local存储
    await StorageManager.setStorageType('local');
    
    await StorageManager.setItem(STORAGE_KEYS.MODEL, model);
    
    if (apiKey) {
        await StorageManager.setItem(STORAGE_KEYS.API_KEY, apiKey);
        console.log('设置已保存 - 模型:', model, '| API Key:', apiKey.substring(0, 5) + '***');
    } else {
        // 如果用户留空，则删除存储的 Key，以便后台使用默认 Key
        await StorageManager.removeItem(STORAGE_KEYS.API_KEY);
        console.log('设置已保存 - 模型:', model, '| 使用默认 API Key');
    }
    
    showStatus('✓ 设置已保存', 'success');

    // 通知后台脚本配置已更新
    notifyBackgroundSettings({
      model: model,
      hasApiKey: true // 无论是用户设置还是默认，现在都应该有 Key
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
  chrome.tabs.create({ url: dashboardUrl });
}

function openProblemSet() {
  // 在新标签页打开题库页面
  const problemsetUrl = chrome.runtime.getURL("problemset/index.html");
  chrome.tabs.create({ url: problemsetUrl });
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

