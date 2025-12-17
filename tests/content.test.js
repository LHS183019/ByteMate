import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { jest } from '@jest/globals';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const contentScriptPath = path.resolve(__dirname, '../content/content-script.js');
const contentScriptCode = fs.readFileSync(contentScriptPath, 'utf8');

describe('Content Script Tests', () => {
  let uiManager;

  beforeAll(() => {
    // Setup DOM
    document.body.innerHTML = '';
    
    // Use fake timers
    jest.useFakeTimers();
    
    // Mock MutationObserver to prevent "Cannot log after tests are done" error
    global.MutationObserver = class {
      constructor(callback) {}
      observe(element, options) {}
      disconnect() {}
    };

    // Mock chrome API
    global.chrome = {
      runtime: {
        sendMessage: jest.fn(),
        connect: jest.fn(() => ({
          onMessage: { addListener: jest.fn() },
          onDisconnect: { addListener: jest.fn() },
          postMessage: jest.fn(),
          disconnect: jest.fn()
        })),
        getURL: jest.fn((path) => path),
        onMessage: {
          addListener: jest.fn()
        }
      },
      storage: {
        local: {
          get: jest.fn(),
          set: jest.fn()
        }
      }
    };

    // Execute the script
    window.eval(contentScriptCode);
  });

  beforeEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
    
    // Instantiate UIManager
    uiManager = new window.UIManager();
  });

  test('Sidebar: Creation and Visibility', () => {
    const sidebar = uiManager.createSidebar();
    expect(sidebar).toBeTruthy();
    expect(sidebar.classList.contains('oj-helper-sidebar')).toBe(true);
    expect(document.body.contains(sidebar)).toBe(true);
  });

  test('Sidebar: Close button works', () => {
    const sidebar = uiManager.createSidebar();
    const collapseSpy = jest.spyOn(uiManager, 'collapseSidebar');
    
    const collapseBtn = sidebar.querySelector('.oj-helper-sidebar-collapse');
    expect(collapseBtn).toBeTruthy();
    
    collapseBtn.click();
    expect(collapseSpy).toHaveBeenCalled();
  });

  test('Sidebar: Retry button works', () => {
    const sidebar = uiManager.createSidebar();
    const reloadBtn = sidebar.querySelector('.oj-helper-sidebar-reload');
    expect(reloadBtn).toBeTruthy();
    
    const onReloadMock = jest.fn();
    uiManager.onReload = onReloadMock;
    
    reloadBtn.click();
    expect(onReloadMock).toHaveBeenCalled();
  });

  test('Feedback: Button appears after content generation', () => {
    // Simulate content area
    const contentArea = document.createElement('div');
    uiManager.contentArea = contentArea;
    uiManager.fullContent = 'Some content with code ```cpp ... ```';
    
    // Call renderFeedbackUI
    uiManager.renderFeedbackUI();
    
    const feedbackRoot = contentArea.querySelector('.oj-helper-feedback-root');
    expect(feedbackRoot).toBeTruthy();
    
    const triggerBtn = feedbackRoot.querySelector('.oj-helper-feedback-btn');
    expect(triggerBtn).toBeTruthy();
    expect(triggerBtn.textContent).toContain('我不满意');
  });

  test('Feedback: Clicking feedback triggers regeneration', () => {
    const contentArea = document.createElement('div');
    uiManager.contentArea = contentArea;
    uiManager.fullContent = 'Some content';
    uiManager.lastPayload = { feature: 'hint' };
    uiManager.hasRegenerated = false;
    
    // Mock sendStreamRequest
    const sendStreamSpy = jest.spyOn(uiManager, 'sendStreamRequest').mockImplementation(() => {});
    
    uiManager.renderFeedbackUI();
    
    const feedbackRoot = contentArea.querySelector('.oj-helper-feedback-root');
    const triggerBtn = feedbackRoot.querySelector('.oj-helper-feedback-btn');
    
    // Click trigger to show options
    triggerBtn.click();
    
    const optionsContainer = feedbackRoot.querySelector('.oj-helper-feedback-options');
    expect(optionsContainer.style.display).not.toBe('none');
    
    // Click an option (e.g., "too_short")
    const optionBtn = optionsContainer.querySelector('button'); // First option
    optionBtn.click();
    
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'send_feedback',
        data: expect.objectContaining({ reason: expect.any(String) })
      })
    );
    
    // Wait for setTimeout in submitFeedback
    jest.runOnlyPendingTimers();
    
    expect(sendStreamSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        isRegeneration: true,
        feedbackReason: expect.any(String)
      })
    );
  });

  test('Menu: Action buttons vary by page type', () => {
    // Mock window.location
    delete window.location;
    window.location = { href: 'http://localhost/problem/1', origin: 'http://localhost', pathname: '/problem/1' };

    // Clear previous menu and setup DOM for problem page detection
    document.body.innerHTML = '<div id="pageTitle">Problem Title</div>';

    // Run createMenu
    if (window._test_createMenu) {
        window._test_createMenu();
    } else {
        console.warn('window._test_createMenu is not available');
        return;
    }

    // Check for "guide" button (Problem Guide)
    const guideBtn = document.querySelector('button[data-key="guide"]');
    expect(guideBtn).toBeTruthy();
    // JSDOM innerText/textContent handling can be tricky
    expect(guideBtn.textContent || guideBtn.innerText).toBe('问题引导');

    // Check that "hint" button (Idea Hint) is NOT present (it's for submit page)
    const hintBtn = document.querySelector('button[data-key="hint"]');
    expect(hintBtn).toBeNull();

    // Change location to submit page
    window.location.href = 'http://localhost/submit/1';
    window.location.pathname = '/submit/1';

    // Clear previous menu and re-run (no need for pageTitle here as it relies on URL)
    document.body.innerHTML = '';
    window._test_createMenu();

    // Check for "hint" button
    const hintBtn2 = document.querySelector('button[data-key="hint"]');
    expect(hintBtn2).toBeTruthy();
    expect(hintBtn2.textContent || hintBtn2.innerText).toBe('思路提示');
  });

  test('Menu: Clicking action button triggers API request', async () => {
    // Mock window.location to problem page
    delete window.location;
    window.location = { href: 'http://localhost/problem/1', origin: 'http://localhost', pathname: '/problem/1' };

    // Clear previous menu and setup DOM
    document.body.innerHTML = '<div id="pageTitle">Problem Title</div>';
    if (window._test_createMenu) {
        window._test_createMenu();
    }

    // Mock chrome.runtime.connect and postMessage
    const postMessageMock = jest.fn();
    const connectMock = jest.fn(() => ({
      onMessage: { addListener: jest.fn() },
      onDisconnect: { addListener: jest.fn() },
      postMessage: postMessageMock,
      disconnect: jest.fn()
    }));
    global.chrome.runtime.connect = connectMock;

    // Mock chrome.runtime.sendMessage
    const sendMessageMock = jest.fn((msg, cb) => {
      if (msg.action === 'get_cached_problem') {
        if (cb) cb({ ok: true, data: { title: 'Test Problem' } });
      }
    });
    global.chrome.runtime.sendMessage = sendMessageMock;

    // Mock fetch for prompt loading
    global.fetch = jest.fn(() => Promise.resolve({
      ok: true,
      text: () => Promise.resolve('Test Prompt Content')
    }));

    // Find and click the guide button
    const guideBtn = document.querySelector('button[data-key="guide"]');
    expect(guideBtn).toBeTruthy();
    
    guideBtn.click();

    // Wait for async chains
    await Promise.resolve(); 
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // Verify connect was called
    expect(connectMock).toHaveBeenCalled();
    
    // Verify postMessage was called with correct payload
    expect(postMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'invoke_feature_stream',
        feature: 'guide'
      })
    );
    
    // Verify context_json contains the expected data
    const lastCall = postMessageMock.mock.calls[0][0];
    const context = JSON.parse(lastCall.context_json);
    expect(context.customPrompt).toBe('Test Prompt Content');
    expect(context.feature).toBe('guide');
    expect(context.title).toBe('Test Problem');
  });

  test('Markdown: List rendering support', () => {
    const markdown = `
- Item 1
* Item 2
+ Item 3
    `.trim();
    
    const html = uiManager.parseMarkdown(markdown);
    
    // Should contain ul and li tags
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>Item 1</li>');
    expect(html).toContain('<li>Item 2</li>');
    expect(html).toContain('<li>Item 3</li>');
    expect(html).toContain('</ul>');
  });

  test('History: showLastResponse sets isStreaming to false', () => {
    // Mock history data
    uiManager.getLatestHistoryByPageType = jest.fn(() => ({
      feature: 'guide',
      data: 'Section 1\n\n__NEXT_STEP__\n\nSection 2',
      timestamp: Date.now()
    }));
    
    uiManager.getCurrentPageType = jest.fn(() => 'problem');
    
    // Call showLastResponse
    uiManager.showLastResponse();
    
    // Check isStreaming flag
    expect(uiManager.isStreaming).toBe(false);
    
    // Check if continue button is rendered (since there are 2 sections)
    const continueBtn = uiManager.contentArea.querySelector('.oj-helper-continue-btn');
    expect(continueBtn).toBeTruthy();
    
    // Simulate clicking continue
    continueBtn.click();
    
    // Since isStreaming is false, feedback UI should appear at the end
    const feedbackBtn = uiManager.contentArea.querySelector('.oj-helper-feedback-btn');
    expect(feedbackBtn).toBeTruthy();
  });
});
