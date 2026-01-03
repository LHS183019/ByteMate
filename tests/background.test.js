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
          set: jest.fn((items, callback) => callback && callback()),
          remove: jest.fn((keys, callback) => callback && callback())
        },
        onChanged: { addListener: jest.fn() }
      },
      contextMenus: {
        create: jest.fn(),
        onClicked: { addListener: jest.fn() }
      },
      tabs: {
        create: jest.fn()
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
    
    // Capture storage change listener
    const storageCalls = global.chrome.storage.onChanged.addListener.mock.calls;
    if (storageCalls.length > 0) {
      bgService.storageChangeListener = storageCalls[0][0];
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Restore message listener mock since clearAllMocks wipes it
    // But we captured the function reference in `messageListener`, so we can still call it.
    // However, we don't need to re-mock addListener, we just need to use the captured function.
    
    // Reset appConfig and promise cache
    if (bgService.resetConfigForTesting) {
      bgService.resetConfigForTesting();
    } else {
      // Fallback if not available (though it should be)
      bgService.appConfig.model = null;
      bgService.appConfig.apiKey = null;
      bgService.appConfig.targetLanguage = 'cpp';
    }
  });

  test('Configuration updates on storage change', () => {
    // Initial state
    bgService.appConfig.model = 'old-model';
    
    // Simulate storage change
    const changes = {
      bytemate_model: { newValue: 'new-model' },
      bytemate_api_key: { newValue: 'new-key' },
      bytemate_target_language: { newValue: 'python' }
    };
    
    bgService.storageChangeListener(changes, 'local');
    
    expect(bgService.appConfig.model).toBe('new-model');
    expect(bgService.appConfig.apiKey).toBe('new-key');
    expect(bgService.appConfig.targetLanguage).toBe('python');
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

  test('generatePrompt constructs prompt correctly with target language', async () => {
    bgService.appConfig.targetLanguage = 'python';
    const context = {
      feature: 'guide',
      title: 'Test Problem',
      statement: 'Problem Statement',
      inputDescription: 'Input Desc',
      outputDescription: 'Output Desc',
      hint: 'Hint',
      currentCode: 'print("hello")',
      samples: [{ input: '1', output: '2' }]
    };

    const prompt = await bgService.generatePrompt(context);
    
    expect(prompt).toContain('Test Problem');
    expect(prompt).toContain('Problem Statement');
    expect(prompt).toContain('print("hello")');
    expect(prompt).toContain('```python'); // Check for python code block
    expect(prompt).toContain('请使用 python 语言生成代码'); // Check for instruction
    expect(prompt).toContain('Mock Prompt Content');
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
        config: { model: 'openai', targetLanguage: 'python' }
      };

      // Mock storage get to return new values after update
      global.chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({
          bytemate_model: 'openai',
          bytemate_api_key: 'test-key',
          bytemate_target_language: 'python'
        });
      });

      await messageListener(request, {}, sendResponse);

      // Wait for async initializeConfig
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(bgService.appConfig.model).toBe('openai');
      expect(bgService.appConfig.targetLanguage).toBe('python');
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

    test('record_problem_solved updates daily stats and saves problem details', async () => {
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

      // Mock fetch for loadProblemSet
      global.fetch.mockImplementation((url) => {
        if (url.includes('all_problems.json')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([
              { id: '1001', title: 'A+B Problem', algorithms: ['Math'], data_structures: [] }
            ])
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      messageListener(request, {}, sendResponse);
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 50));

      // Check if storage was updated
      const today = new Date().toISOString().split('T')[0];
      const todayKey = `oj_daily_stats_${today}`;
      expect(storage[todayKey]).toBeDefined();
      expect(storage[todayKey].completedCount).toBe(1);
      expect(storage[todayKey].completedProblems).toContain('1001');
      
      // Check problem details
      const detailKey = 'oj_problem_details_1001';
      expect(storage[detailKey]).toBeDefined();
      expect(storage[detailKey].title).toBe('A+B Problem');
      expect(storage[detailKey].tags).toContain('Math');
      expect(storage[detailKey].solvedAt).toBe(request.timestamp);
      
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
      bgService.appConfig.targetLanguage = 'python';
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
        expect.objectContaining({
            body: expect.stringContaining('"target_language":"python"')
        })
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
