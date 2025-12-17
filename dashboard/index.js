/**
 * Dashboard 主逻辑文件
 * 负责加载和显示学习进度数据
 */

// 存储管理器
let storage = null;

/**
 * 创建后备存储管理器（使用 localStorage）
 */
function createFallbackStorage() {
  const STORAGE_PREFIX = 'oj_';
  
  return {
    async init() {
      return true;
    },
    
    async getTodayStats() {
      const today = new Date().toISOString().split('T')[0];
      const key = `${STORAGE_PREFIX}daily_stats_${today}`;
      
      // 尝试从Chrome存储读取
      if (typeof chrome !== 'undefined' && chrome.storage) {
        try {
          const result = await new Promise((resolve) => {
            chrome.storage.local.get([key], resolve);
          });
          if (result[key]) {
            return result[key];
          }
        } catch (error) {
          console.warn('Chrome存储读取失败，使用localStorage:', error);
        }
      }
      
      // 回退到localStorage
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : {
        date: today,
        completedCount: 0,
        duration: 0,
        tagsLearned: [],
        startTime: Date.now(),
      };
    },
    
    async getRecentDaysStats(days = 7) {
      const result = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const key = `${STORAGE_PREFIX}daily_stats_${dateStr}`;
        
        let stats = { completedCount: 0, duration: 0 };
        
        // 尝试从Chrome存储读取
        if (typeof chrome !== 'undefined' && chrome.storage) {
          try {
            const chromeResult = await new Promise((resolve) => {
              chrome.storage.local.get([key], resolve);
            });
            if (chromeResult[key]) {
              stats = chromeResult[key];
            }
          } catch (error) {
            // 回退到localStorage
            const data = localStorage.getItem(key);
            if (data) {
              stats = JSON.parse(data);
            }
          }
        } else {
          const data = localStorage.getItem(key);
          if (data) {
            stats = JSON.parse(data);
          }
        }
        
        result.push({
          date: dateStr,
          completedCount: stats.completedCount || 0,
          duration: stats.duration || 0,
        });
      }
      return result;
    },
    
    async getTagsStatistics() {
      const key = STORAGE_PREFIX + 'knowledge_tags';
      const data = localStorage.getItem(key);
      const tags = data ? JSON.parse(data) : {};
      return Object.values(tags).map(tag => ({
        name: tag.name || 'Unknown',
        value: tag.progress || 0,
        count: tag.count || 0,
      }));
    },
    
    async getProblemsSolved() {
      const key = `${STORAGE_PREFIX}problems_solved`;
      
      // 尝试从Chrome存储读取
      if (typeof chrome !== 'undefined' && chrome.storage) {
        try {
          const result = await new Promise((resolve) => {
            chrome.storage.local.get([key], resolve);
          });
          if (result[key]) {
            return result[key];
          }
        } catch (error) {
          console.warn('Chrome存储读取失败，使用localStorage:', error);
        }
      }
      
      // 回退到localStorage
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    },
    
    async getProblemDetail(problemId) {
      const key = `${STORAGE_PREFIX}problem_details_${problemId}`;
      
      // 尝试从Chrome存储读取
      if (typeof chrome !== 'undefined' && chrome.storage) {
        try {
          const result = await new Promise((resolve) => {
            chrome.storage.local.get([key], resolve);
          });
          if (result[key]) {
            return result[key];
          }
        } catch (error) {
          console.warn('Chrome存储读取失败，使用localStorage:', error);
        }
      }
      
      // 回退到localStorage
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    },
    
    async getPetData() {
      const key = STORAGE_PREFIX + 'pet_data';
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : {
        name: '学习伙伴',
        level: 1,
        exp: 0,
        mood: 100,
        hunger: 50,
        lastFeedTime: Date.now(),
        createdAt: Date.now(),
      };
    },
    
    // 模拟数据写入方法（用于测试）
    async addTestData() {
      const today = new Date().toISOString().split('T')[0];
      const todayKey = `${STORAGE_PREFIX}daily_stats_${today}`;
      
      const todayData = {
        date: today,
        completedCount: Math.floor(Math.random() * 10) + 1,
        duration: Math.floor(Math.random() * 7200) + 300, // 5min - 2h
        tagsLearned: ['数据结构', '算法', 'C++'].slice(0, Math.floor(Math.random() * 3) + 1),
        startTime: Date.now(),
      };
      
      // 尝试使用Chrome存储
      if (typeof chrome !== 'undefined' && chrome.storage) {
        try {
          await new Promise((resolve) => {
            chrome.storage.local.set({ [todayKey]: todayData }, resolve);
          });
          console.log('✅ 今日数据已写入Chrome存储');
        } catch (error) {
          console.warn('Chrome存储失败，使用localStorage:', error);
          localStorage.setItem(todayKey, JSON.stringify(todayData));
        }
      } else {
        localStorage.setItem(todayKey, JSON.stringify(todayData));
      }
      
      // 添加最近几天的数据
      const dataToSet = {};
      for (let i = 1; i <= 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const dayKey = `${STORAGE_PREFIX}daily_stats_${dateStr}`;
        
        const dayData = {
          date: dateStr,
          completedCount: Math.floor(Math.random() * 8) + 1,
          duration: Math.floor(Math.random() * 6000) + 600,
          tagsLearned: ['数组', '字符串', '动态规划', '图论'].slice(0, Math.floor(Math.random() * 3) + 1),
          startTime: date.getTime(),
        };
        
        dataToSet[dayKey] = dayData;
        localStorage.setItem(dayKey, JSON.stringify(dayData));
      }
      
      // 添加知识点测试数据
      const tagsKey = `${STORAGE_PREFIX}knowledge_tags`;
      const tagsData = {
        '数据结构': { name: '数据结构', progress: 80, count: 15 },
        '算法': { name: '算法', progress: 60, count: 10 },
        'C++': { name: 'C++', progress: 90, count: 20 },
        '动态规划': { name: '动态规划', progress: 40, count: 5 },
        '图论': { name: '图论', progress: 70, count: 12 },
        '字符串': { name: '字符串', progress: 85, count: 18 },
      };
      dataToSet[tagsKey] = tagsData;
      localStorage.setItem(tagsKey, JSON.stringify(tagsData));
      
      // 添加题目测试数据
      const problemsKey = `${STORAGE_PREFIX}problems_solved`;
      const problemsList = ['2721', '1001', '1002', '1003', '1010', '1020', '1030'];
      dataToSet[problemsKey] = problemsList;
      localStorage.setItem(problemsKey, JSON.stringify(problemsList));
      
      // 添加题目详情
      const problems = [
        { id: '2721', title: 'C:文本二叉树', tags: ['数据结构', '二叉树'], hours: 24 },
        { id: '1001', title: 'A+B Problem', tags: ['基础', '入门'], hours: 1 },
        { id: '1002', title: '排序算法', tags: ['算法', '排序'], hours: 3 },
        { id: '1003', title: '动态规划入门', tags: ['动态规划'], hours: 6 },
        { id: '1010', title: '图的遍历', tags: ['图论', '遍历'], hours: 12 },
        { id: '1020', title: '字符串匹配', tags: ['字符串', '算法'], hours: 2 },
        { id: '1030', title: '贪心算法', tags: ['贪心', '算法'], hours: 4 }
      ];
      
      problems.forEach(problem => {
        const problemKey = `${STORAGE_PREFIX}problem_details_${problem.id}`;
        const problemData = {
          id: problem.id,
          title: problem.title,
          status: 'ac',
          tags: problem.tags,
          solvedAt: Date.now() - (problem.hours * 3600000),
        };
        dataToSet[problemKey] = problemData;
        localStorage.setItem(problemKey, JSON.stringify(problemData));
      });
      
      // 批量写入Chrome存储
      if (typeof chrome !== 'undefined' && chrome.storage) {
        try {
          await new Promise((resolve) => {
            chrome.storage.local.set(dataToSet, resolve);
          });
          console.log('✅ 所有测试数据已写入Chrome存储');
        } catch (error) {
          console.warn('Chrome存储批量写入失败:', error);
        }
      }
      
      console.log('✅ 测试数据已添加（包含最近7天数据）');
    },

    async clearAll() {
      // 清除 localStorage
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(STORAGE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
      
      // 清除 Chrome storage (仅清除 oj_ 开头的键，保留 API Key 等设置)
      if (typeof chrome !== 'undefined' && chrome.storage) {
        try {
          const allData = await new Promise((resolve) => {
            chrome.storage.local.get(null, resolve);
          });
          
          const keysToRemove = Object.keys(allData).filter(key => key.startsWith(STORAGE_PREFIX));
          
          if (keysToRemove.length > 0) {
            await new Promise((resolve) => {
              chrome.storage.local.remove(keysToRemove, resolve);
            });
            console.log('✅ Chrome存储已清理:', keysToRemove.length, '项');
          }
        } catch (error) {
          console.error('清理Chrome存储失败:', error);
        }
      }
      console.log('✅ 仪表板数据已清除 (保留设置)');
    }
  };
}

/**
 * 初始化 Dashboard
 */
async function initDashboard() {
  console.log('🚀 初始化 Dashboard...');
  
  try {
    // 检查Chrome扩展环境
    const hasChromeStorage = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
    console.log('Chrome存储API可用:', hasChromeStorage);
    
    // 始终使用后备存储管理器（它会自动选择最佳存储方式）
    storage = createFallbackStorage();
    await storage.init();
    console.log('✅ 存储管理器初始化完成');
    
    // 检查是否有数据，如果没有则生成测试数据
    const today = new Date().toISOString().split('T')[0];
    const todayKey = `oj_daily_stats_${today}`;
    
    let hasData = false;
    if (hasChromeStorage) {
      try {
        const result = await new Promise((resolve) => {
          chrome.storage.local.get([todayKey], resolve);
        });
        hasData = !!result[todayKey];
      } catch (error) {
        console.warn('检查Chrome存储数据失败:', error);
      }
    }
    
    if (!hasData) {
      const localData = localStorage.getItem(todayKey);
      hasData = !!localData;
    }
    
    // 加载所有数据
    await loadAllData();
    
    console.log('✅ Dashboard 初始化完成');
  } catch (error) {
    console.error('❌ Dashboard 初始化失败:', error);
    showError('初始化失败: ' + error.message);
  }
}

/**
 * 加载所有数据
 */
async function loadAllData() {
  try {
    // 显示加载状态
    showLoading(true);
    
    // 并行加载数据
    await Promise.all([
      loadTodayStats(),
      loadKnowledgeTags(),
      loadRecentProblems(),
      loadPetData(),
    ]);
    
    showLoading(false);
  } catch (error) {
    console.error('加载数据失败:', error);
    showError('加载数据失败: ' + error.message);
    showLoading(false);
  }
}

/**
 * 加载今日学习统计
 */
async function loadTodayStats() {
  try {
    const todayStats = await storage.getTodayStats();
    
    // 更新今日完成题目数
    const completedElement = document.getElementById('today-completed');
    if (completedElement) {
      completedElement.textContent = todayStats.completedCount || 0;
      animateNumber(completedElement, 0, todayStats.completedCount || 0);
    }
    
    // 更新今日学习时长
    const durationElement = document.getElementById('today-duration');
    if (durationElement) {
      const duration = todayStats.duration || 0;
      durationElement.textContent = formatDuration(duration);
    }
    
    // 更新今日掌握知识点数
    const tagsElement = document.getElementById('today-tags');
    if (tagsElement) {
      const tagsCount = (todayStats.tagsLearned || []).length;
      tagsElement.textContent = tagsCount;
      animateNumber(tagsElement, 0, tagsCount);
    }
    
    console.log('✅ 今日统计加载完成:', todayStats);
  } catch (error) {
    console.error('加载今日统计失败:', error);
    throw error;
  }
}

/**
 * 加载知识点掌握情况
 */
async function loadKnowledgeTags() {
  try {
    const tagsStats = await storage.getTagsStatistics();
    
    if (typeof renderKnowledgeChart === 'function') {
      renderKnowledgeChart(tagsStats);
      console.log('✅ 知识点图表加载完成');
    } else {
      console.warn('⚠️ renderKnowledgeChart 函数未定义');
    }
  } catch (error) {
    console.error('加载知识点统计失败:', error);
    throw error;
  }
}

/**
 * 加载最近练习记录
 */
async function loadRecentProblems() {
  try {
    const problemsSolved = await storage.getProblemsSolved();
    const recentProblems = problemsSolved.slice(-10).reverse(); // 最近10题，倒序
    
    const container = document.getElementById('recent-problems-list');
    if (!container) return;
    
    if (recentProblems.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <div class="empty-state-text">暂无练习记录</div>
        </div>
      `;
      return;
    }
    
    // 获取题目详情
    const problemDetails = await Promise.all(
      recentProblems.map(id => storage.getProblemDetail(id))
    );
    
    container.innerHTML = problemDetails
      .filter(p => p) // 过滤掉 null
      .map(problem => createProblemItem(problem))
      .join('');
    
    console.log('✅ 最近练习加载完成');
  } catch (error) {
    console.error('加载最近练习失败:', error);
    throw error;
  }
}

/**
 * 加载宠物数据
 */
async function loadPetData() {
  try {
    const petData = await storage.getPetData();
    
    // 更新宠物状态文字
    const statusElement = document.getElementById('pet-status');
    if (statusElement) {
      statusElement.textContent = `${petData.name} | Lv.${petData.level} | 心情: ${petData.mood}%`;
    }
    
    // 调用宠物渲染函数（如果存在）
    if (typeof renderPet === 'function') {
      renderPet(petData);
      console.log('✅ 宠物数据加载完成');
    } else {
      console.warn('⚠️ renderPet 函数未定义');
    }
  } catch (error) {
    console.error('加载宠物数据失败:', error);
    throw error;
  }
}

/**
 * 创建题目列表项 HTML
 */
function createProblemItem(problem) {
  const solvedDate = problem.solvedAt 
    ? new Date(problem.solvedAt).toLocaleDateString('zh-CN')
    : '未知日期';
  
  const status = problem.status || 'ac';
  const statusClass = status.toLowerCase();
  
  return `
    <div class="problem-item" data-problem-id="${problem.id}">
      <div class="problem-title">
        <span class="problem-status ${statusClass}"></span>
        ${problem.title || problem.id}
      </div>
      <div class="problem-meta">
        <span>📅 ${solvedDate}</span>
        ${problem.tags ? `<span>🏷️ ${problem.tags.join(', ')}</span>` : ''}
      </div>
    </div>
  `;
}

/**
 * 格式化时长（秒转为易读格式）
 */
function formatDuration(seconds) {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

/**
 * 数字动画效果
 */
function animateNumber(element, start, end, duration = 1000) {
  const range = end - start;
  const increment = range / (duration / 16); // 60fps
  let current = start;
  
  const timer = setInterval(() => {
    current += increment;
    if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
      element.textContent = Math.round(end);
      clearInterval(timer);
    } else {
      element.textContent = Math.round(current);
    }
  }, 16);
}

/**
 * 显示/隐藏加载状态
 */
function showLoading(show) {
  const cards = document.querySelectorAll('.card');
  cards.forEach(card => {
    if (show) {
      card.classList.add('loading');
    } else {
      card.classList.remove('loading');
    }
  });
}

/**
 * 显示错误信息
 */
function showError(message) {
  // 移除旧的错误提示
  const oldError = document.querySelector('.error-message');
  if (oldError) oldError.remove();
  
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #ef4444;
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 0.5rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 1000;
    max-width: 400px;
    font-size: 14px;
  `;
  
  errorDiv.innerHTML = `
    <div>${message}</div>
    <button onclick="location.reload()" style="
      background: rgba(255,255,255,0.2);
      border: 1px solid rgba(255,255,255,0.3);
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 0.25rem;
      cursor: pointer;
      margin-top: 0.5rem;
      font-size: 12px;
    ">重新加载</button>
  `;
  
  document.body.appendChild(errorDiv);
  
  setTimeout(() => {
    if (errorDiv.parentNode) {
      errorDiv.remove();
    }
  }, 10000);
}

/**
 * 刷新数据（可手动调用）
 */
async function refreshData() {
  console.log('🔄 刷新数据...');
  await loadAllData();
}

/**
 * 添加事件监听
 */
function setupEventListeners() {
  // 刷新数据按钮
  const refreshBtn = document.getElementById('refresh-data-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      console.log('🔄 手动刷新数据...');
      showLoading(true);
      await loadAllData();
      showLoading(false);
      console.log('✅ 数据刷新完成');
    });
  }

  // 重置数据按钮
  const resetBtn = document.getElementById('reset-data-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (confirm('⚠️ 确定要清空所有数据吗？\n此操作将删除所有学习记录、宠物状态和设置，且无法恢复！')) {
        console.log('🗑️ 正在重置数据...');
        showLoading(true);
        await storage.clearAll();
        // 重新初始化存储结构
        await storage.init();
        // 重新加载页面以重置状态
        window.location.reload();
      }
    });
  }
  
  // 为题目列表项添加点击事件（跳转到题目页面）
  document.addEventListener('click', (e) => {
    const problemItem = e.target.closest('.problem-item');
    if (problemItem) {
      const problemId = problemItem.dataset.problemId;
      if (problemId) {
        // 这里可以跳转到题目页面
        console.log('点击题目:', problemId);
        // window.open(`http://dsa.openjudge.cn/problem/${problemId}/`, '_blank');
      }
    }
  });
  
  // 监听存储变化，自动更新数据
  if (chrome && chrome.storage) {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      console.log('存储发生变化:', changes);
      // 检查是否有我们关心的数据变化
      const relevantChanges = Object.keys(changes).some(key => 
        key.startsWith('oj_daily_stats_') || 
        key.startsWith('oj_problems_solved') ||
        key.startsWith('oj_problem_details_')
      );
      
      if (relevantChanges) {
        console.log('检测到相关数据变化，自动刷新...');
        setTimeout(() => {
          refreshData();
        }, 1000); // 延迟1秒刷新，避免频繁更新
      }
    });
  }
}

/**
 * 页面加载完成后初始化
 */
document.addEventListener('DOMContentLoaded', async () => {
  console.log('📄 DOM 加载完成');
  
  // 延迟一下确保其他脚本加载完成
  setTimeout(async () => {
    await initDashboard();
    setupEventListeners();
  }, 100);
});

// 导出函数供外部调用
window.dashboardAPI = {
  refresh: refreshData,
  loadTodayStats,
  loadKnowledgeTags,
  loadRecentProblems,
  loadPetData,
};
