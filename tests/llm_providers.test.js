import { jest } from '@jest/globals';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('LLM Provider Integration Tests', () => {
  let messageListener;
  let mockFetch;

  beforeAll(async () => {
    // Mock Chrome API
    global.chrome = {
      runtime: {
        onInstalled: { addListener: jest.fn() },
        onMessage: { addListener: jest.fn() },
        onConnect: { addListener: jest.fn() },
        getURL: jest.fn((path) => `chrome-extension://mock-id/${path}`),
        lastError: null,
        id: 'mock-extension-id'
      },
      storage: {
        local: {
          get: jest.fn((keys, callback) => {
            // Default mock implementation
            if (Array.isArray(keys)) {
              const result = {};
              keys.forEach(k => result[k] = null);
              callback(result);
            } else {
              callback({});
            }
          }),
          set: jest.fn((items, callback) => callback && callback())
        },
        onChanged: { addListener: jest.fn() }
      },
      contextMenus: {
        create: jest.fn(),
        onClicked: { addListener: jest.fn() }
      }
    };

    // Mock fetch
    mockFetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Mock AI Response' } }]
        }),
        text: () => Promise.resolve('Mock Prompt Template')
      })
    );
    global.fetch = mockFetch;

    // Import background script
    // We need to use a unique query parameter to ensure it's re-evaluated if needed,
    // but since we only import once in beforeAll, it's fine.
    await import(`../background/background.js?t=${Date.now()}`);

    // Capture message listener
    const calls = global.chrome.runtime.onMessage.addListener.mock.calls;
    if (calls.length > 0) {
      messageListener = calls[0][0];
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  // Helper to set config via storage mock
  const setConfig = (model, apiKey, targetLanguage = 'python') => {
    // Reset background service config cache so it re-reads from storage
    if (window.BackgroundService && window.BackgroundService.resetConfigForTesting) {
      window.BackgroundService.resetConfigForTesting();
    }

    global.chrome.storage.local.get.mockImplementation((keys, callback) => {
      const result = {};
      if (Array.isArray(keys)) {
        if (keys.includes('bytemate_model')) result.bytemate_model = model;
        if (keys.includes('bytemate_api_key')) result.bytemate_api_key = apiKey;
        if (keys.includes('bytemate_target_language')) result.bytemate_target_language = targetLanguage;
      }
      callback(result);
    });
  };

  // Helper to invoke feature via message
  const invokeFeature = (feature, context) => {
    return new Promise((resolve) => {
      const sendResponse = (response) => resolve(response);
      messageListener(
        { 
          action: 'invoke_feature', 
          feature, 
          context_json: JSON.stringify(context) 
        }, 
        {}, 
        sendResponse
      );
    });
  };

  test('OpenAI (GPT-4o) request structure', async () => {
    setConfig('openai', 'sk-openai-key');
    
    // Mock fetch for prompt template first, then API response
    mockFetch
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('Prompt') }) // loadPromptTemplate
      .mockResolvedValueOnce({ // API call
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'OpenAI Response' } }]
        })
      });

    const response = await invokeFeature('guide', { title: 'Test' });

    expect(response.success).toBe(true);
    expect(response.result).toBe('OpenAI Response');

    // Verify API call
    const apiCall = mockFetch.mock.calls.find(call => call[0].includes('api.openai.com'));
    expect(apiCall).toBeDefined();
    expect(apiCall[0]).toBe('https://api.openai.com/v1/chat/completions');
    expect(apiCall[1].method).toBe('POST');
    expect(apiCall[1].headers['Authorization']).toBe('Bearer sk-openai-key');
    
    const body = JSON.parse(apiCall[1].body);
    expect(body.model).toBe('gpt-4o');
    expect(body.messages[0].role).toBe('user');
  });

  test('Google Gemini request structure', async () => {
    setConfig('gemini', 'gemini-key');
    
    mockFetch
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('Prompt') })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Gemini Response' } }]
        })
      });

    const response = await invokeFeature('guide', { title: 'Test' });

    expect(response.success).toBe(true);
    expect(response.result).toBe('Gemini Response');

    const apiCall = mockFetch.mock.calls.find(call => call[0].includes('googleapis.com'));
    expect(apiCall).toBeDefined();
    expect(apiCall[0]).toBe('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
    expect(apiCall[1].headers['Authorization']).toBe('Bearer gemini-key');
    
    const body = JSON.parse(apiCall[1].body);
    expect(body.model).toBe('gemini-1.5-flash');
  });

  test('Anthropic Claude request structure', async () => {
    setConfig('claude', 'sk-ant-key');
    
    mockFetch
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('Prompt') })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: 'Claude Response' }]
        })
      });

    const response = await invokeFeature('guide', { title: 'Test' });

    expect(response.success).toBe(true);
    expect(response.result).toBe('Claude Response');

    const apiCall = mockFetch.mock.calls.find(call => call[0].includes('api.anthropic.com'));
    expect(apiCall).toBeDefined();
    expect(apiCall[0]).toBe('https://api.anthropic.com/v1/messages');
    expect(apiCall[1].headers['x-api-key']).toBe('sk-ant-key');
    expect(apiCall[1].headers['anthropic-version']).toBe('2023-06-01');
    expect(apiCall[1].headers['Authorization']).toBeUndefined(); // Should NOT have Bearer token
    
    const body = JSON.parse(apiCall[1].body);
    expect(body.model).toBe('claude-3-5-sonnet-20240620');
    expect(body.messages[0].role).toBe('user');
    expect(body.max_tokens).toBeDefined();
  });

  test('DeepSeek request structure (Default)', async () => {
    setConfig('deepseek', 'sk-deepseek-key');
    
    mockFetch
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('Prompt') })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'DeepSeek Response' } }]
        })
      });

    const response = await invokeFeature('guide', { title: 'Test' });

    expect(response.success).toBe(true);
    
    const apiCall = mockFetch.mock.calls.find(call => call[0].includes('api.deepseek.com'));
    expect(apiCall).toBeDefined();
    expect(apiCall[1].headers['Authorization']).toBe('Bearer sk-deepseek-key');
  });
});
