/**
 * Dashboard 主逻辑
 * 加载学习统计、知识点、图表、宠物等数据
 */

let currentData = {
  stats: null,
  todayStats: null,
  tags: null,
  pet: null,
  recentDays: null,
};

// ==================== 页面初始化 ====================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('📊 Dashboard 加载中...');
  
  try {
    // 加载所有数据
    await loadAllData();
    
    // 渲染统计卡片
    renderTodayStats();
    
    // 初始化图表
    initCharts();
    
    // 渲染宠物
    initPet();
    
    // 渲染最近练习
    renderRecentProblems();
    
    // 渲染推荐题目
    renderRecommendedProblems();
    
    console.log('✅ Dashboard 加载完成');
  } catch (e) {
    console.error('Dashboard 加载失败:', e);
    showError('加载失败: ' + String(e));
  }
});

// ==================== 数据加载 ====================

/**
 * 从后台加载所有数据
 */
async function loadAllData() {
  try {
    await Promise.all([
      loadLearningStats(),
      loadPetData(),
      loadTagsStats(),
      loadRecentDaysStats(),
    ]);
  } catch (error) {
    console.error('加载数据失败:', error);
    throw error;
  }
}

/**
 * 加载学习统计
 */
async function loadLearningStats() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { action: 'get_learning_stats' },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (response && response.ok) {
          currentData.stats = response.stats || {};
          currentData.todayStats = response.todayStats || {};
          console.log('📈 学习统计加载完成:', currentData.stats);
        } else {
          // 使用默认数据
          currentData.stats = {};
          currentData.todayStats = {};
          console.warn('学习统计加载失败，使用默认数据');
        }
        resolve();
      }
    );
  });
}

/**
 * 加载宠物数据
 */
async function loadPetData() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { action: 'get_pet_data' },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (response && response.ok) {
          currentData.pet = response.pet || getDefaultPetData();
        } else {
          currentData.pet = getDefaultPetData();
          console.warn('宠物数据加载失败，使用默认数据');
        }
        console.log('🐾 宠物数据加载完成:', currentData.pet);
        resolve();
      }
    );
  });
}

/**
 * 加载知识点统计
 */
async function loadTagsStats() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { action: 'get_tags_statistics' },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (response && response.ok) {
          currentData.tags = response.tags || getDefaultTagsData();
        } else {
          currentData.tags = getDefaultTagsData();
          console.warn('知识点数据加载失败，使用默认数据');
        }
        console.log('🏷️ 知识点数据加载完成:', currentData.tags);
        resolve();
      }
    );
  });
}

/**
 * 加载最近7天统计
 */
async function loadRecentDaysStats() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { action: 'get_recent_days_stats', days: 7 },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (response && response.ok) {
          currentData.recentDays = response.stats || generateDefaultRecentDaysData();
        } else {
          currentData.recentDays = generateDefaultRecentDaysData();
          console.warn('最近7天统计加载失败，使用默认数据');
        }
        console.log('📊 最近7天统计:', currentData.recentDays);
        resolve();
      }
    );
  });
}

// ==================== 默认数据生成 ====================

/**
 * 获取默认宠物数据
 */
function getDefaultPetData() {
  return {
    name: '学习小助手',
    level: 1,
    mood: 80,
    hunger: 70,
    exp: 0,
    nextLevelExp: 100
  };
}

/**
 * 获取默认知识点数据
 */
function getDefaultTagsData() {
  return [
    { name: '二叉树', value: 65, count: 8, progress: 65 },
    { name: '动态规划', value: 45, count: 6, progress: 45 },
    { name: '图论', value: 30, count: 4, progress: 30 },
    { name: '排序算法', value: 80, count: 10, progress: 80 },
    { name: '搜索算法', value: 55, count: 7, progress: 55 }
  ];
}

/**
 * 生成默认最近7天数据
 */
function generateDefaultRecentDaysData() {
  const days = [];
  const today = new Date();
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    
    days.push({
      date: date.toISOString().split('T')[0],
      completedCount: Math.floor(Math.random() * 5),
      duration: Math.floor(Math.random() * 7200) + 1800 // 30分钟到2.5小时
    });
  }
  
  return days;
}

// ==================== 渲染函数 ====================

/**
 * 渲染今日统计卡片
 */
function renderTodayStats() {
  const stats = currentData.stats || {};
  const todayStats = currentData.todayStats || {};
  
  const completedEl = document.getElementById('today-completed');
  const durationEl = document.getElementById('today-duration');
  const tagsEl = document.getElementById('today-tags');
  
  if (completedEl) {
    completedEl.textContent = todayStats.completedCount || stats.todayCompleted || 0;
  }
  
  if (durationEl) {
    const totalSeconds = todayStats.duration || stats.todayDuration || 0;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    durationEl.textContent = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }
  
  if (tagsEl) {
    const tagsCount = (todayStats.tagsLearned || []).length;
    tagsEl.textContent = tagsCount > 0 ? tagsCount : (stats.todayTagsCount || 0);
  }
}

/**
 * 初始化图表
 */
function initCharts() {
  // 初始化趋势图表
  if (currentData.recentDays && currentData.recentDays.length > 0) {
    initTrendChart(currentData.recentDays);
  } else {
    console.warn('没有趋势数据可用');
    const trendContainer = document.getElementById('trendChart');
    if (trendContainer) {
      trendContainer.innerHTML = '<div class="empty-state"><div class="empty-state-text">暂无学习趋势数据</div></div>';
    }
  }
  
  // 初始化知识点图表
  if (currentData.tags && currentData.tags.length > 0) {
    initKnowledgeChart(currentData.tags);
  } else {
    console.warn('没有知识点数据可用');
    const knowledgeContainer = document.getElementById('knowledgeChart');
    if (knowledgeContainer) {
      knowledgeContainer.innerHTML = '<div class="empty-state"><div class="empty-state-text">暂无知识点数据</div></div>';
    }
  }
}

/**
 * 初始化趋势图表
 */
function initTrendChart(data) {
  const ctx = document.getElementById('trendChart');
  if (!ctx) {
    console.error('趋势图表容器未找到');
    return;
  }
  
  // 确保数据按日期排序
  const sortedData = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));
  
  const dates = sortedData.map(d => {
    const date = new Date(d.date);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  });
  
  const completed = sortedData.map(d => d.completedCount || 0);
  const hours = sortedData.map(d => Math.round((d.duration || 0) / 3600 * 10) / 10);
  
  // 销毁现有图表实例
  if (ctx.chartInstance) {
    ctx.chartInstance.destroy();
  }
  
  ctx.chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [
        {
          label: '完成题目数',
          data: completed,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          yAxisID: 'y',
        },
        {
          label: '学习时长 (小时)',
          data: hours,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          yAxisID: 'y1',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top',
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              if (context.parsed.y !== null) {
                if (context.dataset.yAxisID === 'y1') {
                  label += context.parsed.y + ' 小时';
                } else {
                  label += context.parsed.y + ' 题';
                }
              }
              return label;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: '完成题目数',
          },
          beginAtZero: true,
          min: 0,
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: '学习时长 (小时)',
          },
          beginAtZero: true,
          min: 0,
          grid: {
            drawOnChartArea: false,
          },
        },
      },
    },
  });
}

/**
 * 初始化知识点饼图
 */
function initKnowledgeChart(tags) {
  const ctx = document.getElementById('knowledgeChart');
  if (!ctx) {
    console.error('知识点图表容器未找到');
    return;
  }
  
  const labels = tags.map(t => t.name);
  const data = tags.map(t => t.value || t.progress || 0);
  const counts = tags.map(t => t.count || 0);
  
  const colors = [
    '#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#f43f5e',
    '#f97316', '#eab308', '#84cc16', '#22c55e', '#10b981',
  ];
  
  // 销毁现有图表实例
  if (ctx.chartInstance) {
    ctx.chartInstance.destroy();
  }
  
  ctx.chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [
        {
          data: data,
          backgroundColor: colors.slice(0, labels.length),
          borderColor: '#ffffff',
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            usePointStyle: true,
            padding: 20,
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed;
              const count = counts[context.dataIndex] || 0;
              return `${label}: ${value}% (${count}题)`;
            },
          },
        },
      },
      cutout: '60%',
    },
  });
}

/**
 * 初始化宠物
 */
function initPet() {
  const container = document.getElementById('pet-container');
  const statusEl = document.getElementById('pet-status');
  
  if (!container) return;
  
  const pet = currentData.pet || getDefaultPetData();
  
  // 清空容器
  container.innerHTML = '';
  
  // 调用 pet.js 中的渲染函数（如果存在）
  if (typeof renderPetAnimation === 'function') {
    renderPetAnimation(container, pet);
  } else {
    // 备用方案：显示宠物信息
    container.innerHTML = `
      <div style="text-align: center; width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center;">
        <div style="font-size: 4em; margin-bottom: 0.5rem;">🐱</div>
        <div style="font-weight: 600; font-size: 1.1rem;">${pet.name}</div>
        <div style="font-size: 0.875rem; color: #6b7280;">Lv.${pet.level}</div>
        <div style="margin-top: 1rem; font-size: 0.75rem; color: #6b7280;">
          <div>经验: ${pet.exp}/${pet.nextLevelExp || 100}</div>
        </div>
      </div>
    `;
  }
  
  // 更新宠物状态
  let status = '心情良好 😊';
  if (pet.mood < 30) {
    status = '很伤心 😢';
  } else if (pet.mood < 60) {
    status = '有点不开心 😕';
  } else if (pet.mood < 100) {
    status = '开心 😊';
  } else {
    status = '超级开心 😄';
  }
  
  if (statusEl) {
    statusEl.textContent = `状态: ${status} | 饱食度: ${pet.hunger}% | 等级: Lv.${pet.level}`;
  }
}

/**
 * 喂食宠物
 */
async function feedPet() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { action: 'feed_pet' },
      (response) => {
        if (response && response.ok) {
          currentData.pet = response.pet;
          initPet(); // 重新渲染宠物
          showSuccess(response.message || '宠物已被喂食！');
          console.log('🍖 宠物已被喂食');
        } else {
          showError('喂食失败，请重试');
        }
        resolve();
      }
    );
  });
}

/**
 * 渲染最近练习
 */
function renderRecentProblems() {
  const container = document.getElementById('recent-problems-list');
  if (!container) return;
  
  const todayStats = currentData.todayStats || {};
  const tagsLearned = todayStats.tagsLearned || [];
  
  if (tagsLearned.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📝</div><div class="empty-state-text">今天还没有练习题目呢，加油！</div></div>';
    return;
  }
  
  // 显示今天学习的知识点作为最近练习
  container.innerHTML = tagsLearned.map(tag => `
    <div class="problem-item">
      <div class="problem-title">
        <span class="problem-status ac"></span>
        ${tag}
      </div>
      <div class="problem-meta">
        <span>📚 今日学习</span>
      </div>
    </div>
  `).join('');
}

/**
 * 渲染推荐题目
 */
function renderRecommendedProblems() {
  const container = document.getElementById('recommended-problems-list');
  if (!container) return;
  
  const tags = currentData.tags || [];
  
  if (tags.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">💡</div><div class="empty-state-text">完成更多题目以获得推荐</div></div>';
    return;
  }
  
  // 根据掌握程度推荐题目（推荐掌握程度较低的）
  const recommendations = tags
    .filter(t => (t.progress || t.value) < 80) // 只推荐掌握程度低于80%的
    .sort((a, b) => (a.progress || a.value) - (b.progress || b.value)) // 掌握程度低的优先
    .slice(0, 5);
  
  if (recommendations.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🎉</div><div class="empty-state-text">你已掌握所有知识点！</div></div>';
    return;
  }
  
  container.innerHTML = recommendations.map((tag, idx) => {
    const progress = tag.progress || tag.value || 0;
    return `
    <div class="problem-item">
      <div class="problem-title">
        <span class="problem-status in-progress"></span>
        #${idx + 1} ${tag.name} (${tag.count || 0} 题)
      </div>
      <div class="problem-meta">
        <span>进度: ${progress}% | 推荐继续练习</span>
      </div>
      <div style="margin-top: 0.5rem;">
        <div style="height: 4px; background: #e5e7eb; border-radius: 2px; overflow: hidden;">
          <div style="height: 100%; width: ${progress}%; background: linear-gradient(90deg, #6366f1, #818cf8); transition: width 0.3s ease;"></div>
        </div>
      </div>
    </div>
  `}).join('');
}

// ==================== 辅助函数 ====================

/**
 * 显示成功提示
 */
function showSuccess(message) {
  showNotification(message, 'success');
}

/**
 * 显示错误提示
 */
function showError(message) {
  showNotification(message, 'error');
}

/**
 * 显示通知
 */
function showNotification(message, type = 'info') {
  // 移除现有的通知
  const existingNotifications = document.querySelectorAll('.dashboard-notification');
  existingNotifications.forEach(el => el.remove());
  
  const el = document.createElement('div');
  el.className = `dashboard-notification notification-${type}`;
  el.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#6366f1'};
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 0.5rem;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    z-index: 9999;
    animation: slideInRight 0.3s ease-out;
    max-width: 300px;
    word-wrap: break-word;
  `;
  el.textContent = (type === 'success' ? '✓ ' : type === 'error' ? '✗ ' : 'ℹ ') + message;
  document.body.appendChild(el);
  
  setTimeout(() => {
    el.style.animation = 'slideOutRight 0.3s ease-in';
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

// 添加CSS动画
if (!document.querySelector('#notification-styles')) {
  const style = document.createElement('style');
  style.id = 'notification-styles';
  style.textContent = `
    @keyframes slideInRight {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    @keyframes slideOutRight {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}

// ==================== 事件监听器 ====================

// 添加喂食按钮事件监听
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-action="feed-pet"]')) {
    e.preventDefault();
    feedPet();
  }
});

// ==================== 定期刷新 ====================

/**
 * 定期刷新数据（每 30 秒）
 */
let refreshInterval = setInterval(async () => {
  console.log('🔄 刷新 Dashboard 数据...');
  try {
    await loadAllData();
    renderTodayStats();
    renderRecentProblems();
    renderRecommendedProblems();
    
    // 重新初始化图表以更新数据
    initCharts();
  } catch (error) {
    console.error('刷新数据失败:', error);
  }
}, 30 * 1000);

/**
 * 定期更新宠物心情（每 60 秒）
 */
let petUpdateInterval = setInterval(() => {
  chrome.runtime.sendMessage(
    { action: 'update_pet_mood' },
    (response) => {
      if (response && response.ok) {
        currentData.pet = response.pet;
        initPet();
      }
    }
  );
}, 60 * 1000);

// ==================== 清理函数 ====================

/**
 * 清理资源
 */
function cleanup() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
  if (petUpdateInterval) {
    clearInterval(petUpdateInterval);
  }
  
  // 销毁图表实例
  const trendChart = document.getElementById('trendChart');
  const knowledgeChart = document.getElementById('knowledgeChart');
  
  if (trendChart && trendChart.chartInstance) {
    trendChart.chartInstance.destroy();
  }
  if (knowledgeChart && knowledgeChart.chartInstance) {
    knowledgeChart.chartInstance.destroy();
  }
}

// 页面卸载时清理资源
window.addEventListener('beforeunload', cleanup);