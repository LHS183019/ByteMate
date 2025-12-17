import { jest } from '@jest/globals';

jest.unstable_mockModule('../api/storage.js', () => ({
  StorageManager: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    setStorageType: jest.fn(),
  }
}));

const { loadSettings, loadTodayStats, attachEventListeners, initDOM } = await import('../popup/popup.js');
const { StorageManager } = await import('../api/storage.js');

describe('Popup Tests', () => {
  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = `
      <select id="model-select">
        <option value="deepseek">DeepSeek</option>
        <option value="zhipu">Zhipu</option>
      </select>
      <input id="api-key-input" />
      <button id="toggle-password-btn"></button>
      <button id="save-btn"></button>
      <button id="dashboard-btn"></button>
      <button id="problemset-btn"></button>
      <div id="status-message"></div>
      <span id="solved-count"></span>
      <span id="helped-count"></span>
      <span id="tags-count"></span>
      <a id="help-link"></a>
    `;
    initDOM();
    jest.clearAllMocks();
  });

  test('loadSettings should load model and api key', async () => {
    StorageManager.getItem.mockImplementation((key) => {
      if (key === 'bytemate_model') return Promise.resolve('deepseek');
      if (key === 'bytemate_api_key') return Promise.resolve('test-key');
      return Promise.resolve(null);
    });

    await loadSettings();

    expect(document.getElementById('model-select').value).toBe('deepseek');
    expect(document.getElementById('api-key-input').value).toBe('test-key');
  });

  test('loadTodayStats should display stats', async () => {
    const today = new Date().toISOString().split('T')[0];
    StorageManager.getItem.mockImplementation((key) => {
      if (key === 'bytemate_daily_stats') return Promise.resolve({ solved: 5, helped: 3, tags: 2 });
      if (key === 'bytemate_last_reset') return Promise.resolve(today);
      return Promise.resolve(null);
    });

    await loadTodayStats();

    expect(document.getElementById('solved-count').textContent).toBe('5');
    expect(document.getElementById('helped-count').textContent).toBe('3');
    expect(document.getElementById('tags-count').textContent).toBe('2');
  });

  test('Save button should save settings', async () => {
    // Attach listeners first
    attachEventListeners();
    
    const saveBtn = document.getElementById('save-btn');
    const apiKeyInput = document.getElementById('api-key-input');
    const modelSelect = document.getElementById('model-select');
    
    apiKeyInput.value = 'new-key-longer-than-10';
    modelSelect.value = 'zhipu';
    
    StorageManager.setItem.mockResolvedValue(true);
    
    saveBtn.click();
    
    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 0));
    
    expect(StorageManager.setItem).toHaveBeenCalledWith('bytemate_api_key', 'new-key-longer-than-10');
    expect(StorageManager.setItem).toHaveBeenCalledWith('bytemate_model', 'zhipu');
  });

  test('Dashboard button should open dashboard', () => {
    attachEventListeners();
    const dashboardBtn = document.getElementById('dashboard-btn');
    
    // Mock chrome.tabs.query to return empty or simulate failure to force fallback or just check calls
    // openDashboard calls tryOpenInCurrentTab
    // Let's just check if it calls getURL
    
    dashboardBtn.click();
    expect(chrome.runtime.getURL).toHaveBeenCalledWith('dashboard/index.html');
  });
});
