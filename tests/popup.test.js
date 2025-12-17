import { jest } from '@jest/globals';

jest.unstable_mockModule('../api/storage.js', () => ({
  StorageManager: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    setStorageType: jest.fn(),
  }
}));

const { loadSettings, attachEventListeners, initDOM } = await import('../popup/popup.js');
const { StorageManager } = await import('../api/storage.js');

describe('Popup Tests', () => {
  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = `
      <select id="model-select">
        <option value="deepseek">DeepSeek</option>
        <option value="qwen">Qwen</option>
      </select>
      <input id="api-key-input" />
      <button id="toggle-password-btn"></button>
      <button id="save-btn"></button>
      <button id="dashboard-btn"></button>
      <button id="problemset-btn"></button>
      <div id="status-message"></div>
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

  test('Save button should save settings', async () => {
    // Attach listeners first
    attachEventListeners();
    
    const saveBtn = document.getElementById('save-btn');
    const apiKeyInput = document.getElementById('api-key-input');
    const modelSelect = document.getElementById('model-select');
    
    apiKeyInput.value = 'new-key-longer-than-10';
    modelSelect.value = 'qwen';
    
    StorageManager.setItem.mockResolvedValue(true);
    
    saveBtn.click();
    
    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 0));
    
    expect(StorageManager.setItem).toHaveBeenCalledWith('bytemate_api_key', 'new-key-longer-than-10');
    expect(StorageManager.setItem).toHaveBeenCalledWith('bytemate_model', 'qwen');
  });

  test('Dashboard button should open dashboard', () => {
    attachEventListeners();
    const dashboardBtn = document.getElementById('dashboard-btn');
    
    dashboardBtn.click();
    expect(chrome.runtime.getURL).toHaveBeenCalledWith('dashboard/index.html');
    expect(chrome.tabs.create).toHaveBeenCalledWith({ url: 'dashboard/index.html' });
  });
});
