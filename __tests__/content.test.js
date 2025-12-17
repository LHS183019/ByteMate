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
    
    // Mock chrome API
    global.chrome = {
      runtime: {
        sendMessage: jest.fn(),
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
});
