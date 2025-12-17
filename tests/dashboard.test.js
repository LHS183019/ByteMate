import { jest } from '@jest/globals';

// Mock chrome API
const mockStorage = {
  local: {
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
  },
  onChanged: {
    addListener: jest.fn(),
  },
};

global.chrome = {
  storage: mockStorage,
  runtime: {
    sendMessage: jest.fn(),
    lastError: null,
  },
};

// Mock localStorage
const localStorageMock = (function() {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    // Helper for tests
    _getData: () => store,
    _setData: (data) => { store = { ...data }; }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock DOM elements
document.body.innerHTML = `
  <div id="today-completed">0</div>
  <div id="today-duration">0s</div>
  <div id="today-tags">0</div>
  <div id="pet-status"></div>
  <div id="recent-problems-list"></div>
  <div id="refresh-data-btn"></div>
  <div id="reset-data-btn"></div>
  <div class="feedback-form" style="display: flex;">
    <textarea id="feedback-text"></textarea>
    <button id="submit-feedback-btn"></button>
  </div>
  <div id="feedback-success-msg" style="display: none;"></div>
`;

// Mock global functions that might be missing
window.renderKnowledgeChart = jest.fn();
window.renderPet = jest.fn();
window.initPetInteractions = jest.fn();
window.confirm = jest.fn(() => true);
window.alert = jest.fn();

describe('Dashboard', () => {
  let dashboardAPI;

  beforeAll(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-12-18T12:00:00Z')); // Set fixed time
    
    // Load the dashboard script
    await import('../dashboard/index.js');
    
    // Trigger DOMContentLoaded to start initialization
    document.dispatchEvent(new Event('DOMContentLoaded'));
    
    // Fast-forward timers to allow initDashboard to run
    jest.runAllTimers();
    
    dashboardAPI = window.dashboardAPI;
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    localStorageMock.clear();
    // Reset time for each test
    jest.setSystemTime(new Date('2025-12-18T12:00:00Z')); 
    
    document.body.innerHTML = `
      <div id="today-completed">0</div>
      <div id="today-duration">0s</div>
      <div id="today-tags">0</div>
      <div id="pet-status"></div>
      <div id="recent-problems-list"></div>
      <div id="refresh-data-btn"></div>
      <div id="reset-data-btn"></div>
      <div class="feedback-form" style="display: flex;">
        <textarea id="feedback-text"></textarea>
        <button id="submit-feedback-btn"></button>
      </div>
      <div id="feedback-success-msg" style="display: none;"></div>
    `;
  });

  test('should initialize dashboard and load data', async () => {
    // Setup mock data
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayKey = `oj_daily_stats_${year}-${month}-${day}`;
    
    const mockData = {
      [todayKey]: {
        completedCount: 5,
        duration: 3600,
        tagsLearned: ['DP', 'Graph'],
      }
    };

    mockStorage.local.get.mockImplementation((keys, callback) => {
      const result = {};
      if (Array.isArray(keys)) {
        keys.forEach(k => {
          if (mockData[k]) result[k] = mockData[k];
        });
      }
      callback(result);
    });

    // Call loadTodayStats
    await dashboardAPI.loadTodayStats();

    // Check if DOM is updated
    expect(document.getElementById('today-completed').textContent).toBe('5');
    expect(document.getElementById('today-duration').textContent).toBe('1h 0m');
    expect(document.getElementById('today-tags').textContent).toBe('2');
  });

  test('should load recent problems', async () => {
    const problemsSolvedKey = 'oj_problems_solved';
    const problemDetailKey = 'oj_problem_details_1001';

    const mockData = {
      [problemsSolvedKey]: ['1001'],
      [problemDetailKey]: {
        id: '1001',
        title: 'A+B Problem',
        status: 'ac',
        tags: ['Basic'],
        solvedAt: Date.now(),
      }
    };

    mockStorage.local.get.mockImplementation((keys, callback) => {
      const result = {};
      if (Array.isArray(keys)) {
        keys.forEach(k => {
          if (mockData[k]) result[k] = mockData[k];
        });
      } else if (typeof keys === 'string') {
         if (mockData[keys]) result[keys] = mockData[keys];
      }
      callback(result);
    });

    await dashboardAPI.loadRecentProblems();

    const list = document.getElementById('recent-problems-list');
    expect(list.innerHTML).toContain('A+B Problem');
    expect(list.innerHTML).toContain('Basic');
  });

  test('should handle fallback to localStorage if chrome storage fails', async () => {
    // Mock chrome storage failure
    mockStorage.local.get.mockImplementation((keys, callback) => {
      callback({}); 
    });

    // Setup localStorage data
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayKey = `oj_daily_stats_${year}-${month}-${day}`;

    const localData = {
      completedCount: 3,
      duration: 1800,
      tagsLearned: ['Greedy'],
    };
    localStorageMock.setItem(todayKey, JSON.stringify(localData));

    await dashboardAPI.loadTodayStats();

    expect(document.getElementById('today-completed').textContent).toBe('3');
    expect(document.getElementById('today-duration').textContent).toBe('30m');
  });

  test('should submit feedback', async () => {
    // Manually setup listeners since we reset the body
    dashboardAPI.setupEventListeners();

    const submitBtn = document.getElementById('submit-feedback-btn');
    const feedbackText = document.getElementById('feedback-text');
    
    feedbackText.value = 'Great extension!';
    
    // Mock sendMessage response
    global.chrome.runtime.sendMessage.mockImplementation((msg, callback) => {
      if (msg.action === 'submit_feedback') {
        callback({ success: true });
      }
    });

    submitBtn.click();

    // Wait for async handler
    await Promise.resolve(); 
    await Promise.resolve();

    expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'submit_feedback',
        text: 'Great extension!',
      }),
      expect.any(Function)
    );
    
    expect(document.getElementById('feedback-success-msg').style.display).toBe('block');
  });
});
