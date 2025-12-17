import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { jest } from '@jest/globals';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Background Service Tests', () => {
  let bgService;
  let messageListener;

  beforeAll(async () => {
    // Mock Chrome API
    global.chrome = {
      runtime: {
        onInstalled: { addListener: jest.fn() },
        onMessage: { addListener: jest.fn() },
        onConnect: { addListener: jest.fn() },
        getURL: jest.fn((path) => `chrome-extension://mock-id/${path}`),
        lastError: null
      },
      storage: {
        local: {
          get: jest.fn((keys, callback) => callback({})),
          set: jest.fn((items, callback) => callback && callback())
        }
      },
      contextMenus: {
        create: jest.fn(),
        onClicked: { addListener: jest.fn() }
      }
    };

    // Mock fetch
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve('Mock Prompt Content')
      })
    );

    // Import background script
    // This will execute the script and attach to window.BackgroundService
    await import('../background/background.js');
    bgService = window.BackgroundService;

    // Capture message listener immediately after import
    const calls = global.chrome.runtime.onMessage.addListener.mock.calls;
    if (calls.length > 0) {
      messageListener = calls[0][0];
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Restore message listener mock since clearAllMocks wipes it
    // But we captured the function reference in `messageListener`, so we can still call it.
    // However, we don't need to re-mock addListener, we just need to use the captured function.
    
    // Reset appConfig if possible, or just rely on initializeConfig
    bgService.appConfig.model = null;
    bgService.appConfig.apiKey = null;
  });

  test('initializeConfig loads settings from storage', async () => {
    // Mock storage to return specific values
    global.chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({
        bytemate_model: 'qwen',
        bytemate_api_key: 'test-key'
      });
    });

    await bgService.initializeConfig();

    expect(bgService.appConfig.model).toBe('qwen');
    expect(bgService.appConfig.apiKey).toBe('test-key');
  });

  test('initializeConfig uses defaults when storage is empty', async () => {
    global.chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({});
    });

    await bgService.initializeConfig();

    expect(bgService.appConfig.model).toBe('deepseek'); // Default
    expect(bgService.appConfig.apiKey).toBe(''); // Default
  });

  test('getLLMConfig returns correct config for known provider', () => {
    bgService.appConfig.model = 'qwen';
    bgService.appConfig.apiKey = 'sk-123';

    const config = bgService.getLLMConfig();
    expect(config.model).toBe('qwen-plus');
    expect(config.apiKey).toBe('sk-123');
    expect(config.baseUrl).toContain('aliyuncs');
  });

  test('getLLMConfig handles legacy model names', () => {
    bgService.appConfig.model = 'Qwen (通义千问)';
    bgService.appConfig.apiKey = 'sk-456';

    const config = bgService.getLLMConfig();
    expect(config.model).toBe('qwen-plus'); // Should map to qwen config
    expect(config.apiKey).toBe('sk-456');
  });

  test('generatePrompt constructs prompt correctly', async () => {
    const context = {
      feature: 'guide',
      title: 'Test Problem',
      statement: 'Problem Statement',
      inputDescription: 'Input Desc',
      outputDescription: 'Output Desc',
      hint: 'Hint',
      currentCode: 'int main() {}',
      samples: [{ input: '1', output: '2' }]
    };

    const prompt = await bgService.generatePrompt(context);
    
    expect(prompt).toContain('Test Problem');
    expect(prompt).toContain('Problem Statement');
    expect(prompt).toContain('int main() {}');
    expect(prompt).toContain('Mock Prompt Content'); // From mocked fetch
  });

  test('generatePrompt adds feedback instruction', async () => {
    const context = {
      feature: 'guide',
      title: 'Test',
      feedbackReason: 'too_long'
    };

    const prompt = await bgService.generatePrompt(context);
    expect(prompt).toContain('请务必精简内容');
  });

  describe('Message Handling', () => {
    test('update_config updates appConfig', async () => {
      const sendResponse = jest.fn();
      const request = {
        action: 'update_config',
        config: { model: 'openai' }
      };

      // Mock storage get to return new values after update
      global.chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({
          bytemate_model: 'openai',
          bytemate_api_key: 'test-key'
        });
      });

      await messageListener(request, {}, sendResponse);

      // Wait for async initializeConfig
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(bgService.appConfig.model).toBe('openai');
      expect(sendResponse).toHaveBeenCalledWith({ ok: true, message: '配置已更新' });
    });

    test('cache_problem stores data in memory cache', () => {
      const sendResponse = jest.fn();
      const request = {
        action: 'cache_problem',
        path: '/problem/1001',
        data: { title: 'A+B' }
      };

      messageListener(request, {}, sendResponse);

      // Verify cache via get_cached_problem
      const getRequest = {
        action: 'get_cached_problem',
        path: '/problem/1001'
      };
      const getResponse = jest.fn();
      
      messageListener(getRequest, {}, getResponse);
      
      expect(getResponse).toHaveBeenCalledWith(expect.objectContaining({
        ok: true,
        data: { title: 'A+B' }
      }));
    });

    test('record_problem_solved updates daily stats', async () => {
      const sendResponse = jest.fn();
      const request = {
        action: 'record_problem_solved',
        problemId: '1001',
        timestamp: Date.now()
      };

      // Mock storage
      const storage = {};
      global.chrome.storage.local.get.mockImplementation((keys, callback) => {
        const result = {};
        keys.forEach(k => result[k] = storage[k]);
        callback(result);
      });
      global.chrome.storage.local.set.mockImplementation((items, callback) => {
        Object.assign(storage, items);
        if (callback) callback();
      });

      // Since recordProblemSolved is async and not awaited in the listener (it returns true),
      // we need to wait a bit or mock the implementation to be synchronous if possible.
      // However, the listener calls recordProblemSolved(...).then(...)
      // We can await the promise returned by the listener if it returns one, 
      // but the listener returns `true` for async response.
      // We'll rely on the fact that the promise chain inside listener executes.
      
      // To make this test robust, we can spy on console.log or just wait.
      // Better yet, we can invoke the internal function if exposed, but here we test the message handler.
      
      // Let's just call the handler and wait a tick.
      messageListener(request, {}, sendResponse);
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10));

      // Check if storage was updated
      const today = new Date().toISOString().split('T')[0];
      const todayKey = `oj_daily_stats_${today}`;
      expect(storage[todayKey]).toBeDefined();
      expect(storage[todayKey].completedCount).toBe(1);
      expect(storage[todayKey].completedProblems).toContain('1001');
      expect(sendResponse).toHaveBeenCalledWith({ ok: true });
    });

    test('test_ping returns pong', () => {
      const sendResponse = jest.fn();
      const request = { action: 'test_ping' };
      
      messageListener(request, {}, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
        ok: true,
        message: 'pong'
      }));
    });

    test('open_url opens a new tab', () => {
      const sendResponse = jest.fn();
      const request = { action: 'open_url', url: 'http://example.com' };
      
      // Mock chrome.tabs.create
      global.chrome.tabs = { create: jest.fn((opts, cb) => cb && cb()) };
      
      messageListener(request, {}, sendResponse);
      
      expect(global.chrome.tabs.create).toHaveBeenCalledWith(
        { url: 'http://example.com' },
        expect.any(Function)
      );
      expect(sendResponse).toHaveBeenCalledWith({ ok: true });
    });

    test('copy_code updates lastCopyTime and sends telemetry', async () => {
      const sendResponse = jest.fn();
      const request = { action: 'copy_code', data: { length: 100 } };
      
      // Mock storage set
      const setSpy = jest.fn();
      global.chrome.storage.local.set = setSpy;
      
      // Mock fetch for telemetry
      global.fetch.mockClear();
      
      messageListener(request, {}, sendResponse);
      
      // Wait for async telemetry
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(setSpy).toHaveBeenCalledWith(
        expect.objectContaining({ lastCopyTime: expect.any(Number) })
      );
      // Telemetry is async, but we can check if fetch was called
      // Note: sendTelemetryEvent uses fetch
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('google-analytics'),
        expect.anything()
      );
    });

    test('invoke_feature calls LLM and returns result', async () => {
      const sendResponse = jest.fn();
      const context = {
        feature: 'guide',
        title: 'Test Problem',
        statement: 'Statement'
      };
      const request = {
        action: 'invoke_feature',
        feature: 'guide',
        context_json: JSON.stringify(context)
      };

      // Mock storage for initializeConfig
      global.chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({
          bytemate_model: 'qwen',
          bytemate_api_key: 'test-key'
        });
      });

      // Mock fetch response for LLM
      global.fetch.mockImplementation((url) => {
        if (url.includes('prompts/')) {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve('Prompt Template')
          });
        }
        if (url.includes('chat/completions')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              choices: [{ message: { content: 'AI Response' } }]
            })
          });
        }
        // Default fallback for other requests (like telemetry)
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      messageListener(request, {}, sendResponse);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        result: 'AI Response'
      }));
    });
  });
});
