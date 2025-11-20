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
  const STORAGE_PREFIX = 'bytemate_';
  
  return {
    async init() {
      return true;
    },
    
    async getTodayStats() {
      const today = new Date().toISOString().split('T')[0];
      const key = STORAGE_PREFIX + 'daily_stats_' + today;
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
        const key = STORAGE_PREFIX + 'daily_stats_' + dateStr;
        const data = localStorage.getItem(key);
        const stats = data ? JSON.parse(data) : { completedCount: 0, duration: 0 };
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
      const key = STORAGE_PREFIX + 'problems_solved';
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    },
    
    async getProblemDetail(problemId) {
      const key = STORAGE_PREFIX + 'problem_details_' + problemId;
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
      const todayKey = STORAGE_PREFIX + 'daily_stats_' + today;
      
      // 添加今日测试数据
      localStorage.setItem(todayKey, JSON.stringify({
        date: today,
        completedCount: Math.floor(Math.random() * 10) + 1,
        duration: Math.floor(Math.random() * 7200) + 300, // 5min - 2h
        tagsLearned: ['数据结构', '算法', 'C++'].slice(0, Math.floor(Math.random() * 3) + 1),
        startTime: Date.now(),
      }));
      
      // 添加知识点测试数据
      const tagsKey = STORAGE_PREFIX + 'knowledge_tags';
      localStorage.setItem(tagsKey, JSON.stringify({
        '数据结构': { name: '数据结构', progress: 80, count: 15 },
        '算法': { name: '算法', progress: 60, count: 10 },
        'C++': { name: 'C++', progress: 90, count: 20 },
        '动态规划': { name: '动态规划', progress: 40, count: 5 },
      }));
      
      // 添加题目测试数据
      const problemsKey = STORAGE_PREFIX + 'problems_solved';
      localStorage.setItem(problemsKey, JSON.stringify(['2721', '1001', '1002', '1003']));
      
      // 添加题目详情
      localStorage.setItem(STORAGE_PREFIX + 'problem_details_2721', JSON.stringify({
        id: '2721',
        title: 'C:文本二叉树',
        status: 'ac',
        tags: ['数据结构', '二叉树'],
        solvedAt: Date.now() - 86400000, // 昨天
      }));
      
      localStorage.setItem(STORAGE_PREFIX + 'problem_details_1001', JSON.stringify({
        id: '1001',
        title: 'A+B Problem',
        status: 'ac',
        tags: ['基础', '入门'],
        solvedAt: Date.now() - 3600000, // 1小时前
      }));
      
      console.log('✅ 测试数据已添加');
    }
  };
}

/**
 * 初始化 Dashboard
 */
async function initDashboard() {
  console.log('🚀 初始化 Dashboard...');
  
  try {
    // 尝试使用 Chrome Extension 存储
    if (typeof storageManager !== 'undefined' && typeof chrome !== 'undefined' && chrome.storage) {
      console.log('✅ 使用 Chrome Extension 存储');
      storage = storageManager;
      await storage.init();
    } else {
      console.log('⚠️ Chrome Extension API 不可用，使用后备存储');
      storage = createFallbackStorage();
      await storage.init();
      
      // 如果是测试环境，添加一些测试数据
      if (localStorage.getItem('bytemate_daily_stats_' + new Date().toISOString().split('T')[0]) === null) {
        await storage.addTestData();
      }
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
      loadRecentTrend(),
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
 * 加载最近7天学习趋势
 */
async function loadRecentTrend() {
  try {
    const recentStats = await storage.getRecentDaysStats(7);
    
    if (typeof renderTrendChart === 'function') {
      renderTrendChart(recentStats);
      console.log('✅ 趋势图表加载完成');
    } else {
      console.warn('⚠️ renderTrendChart 函数未定义');
    }
  } catch (error) {
    console.error('加载学习趋势失败:', error);
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
      // 可以选择性地更新相关数据
      refreshData();
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
  loadRecentTrend,
  loadKnowledgeTags,
  loadRecentProblems,
  loadPetData,
};
