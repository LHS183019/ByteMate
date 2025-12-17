/**
 * 图表绘制模块
 * 基于 Chart.js 的各类数据可视化
 */

// ==================== 全局图表实例 ====================

let chartInstances = {
  knowledgeChart: null,
};

// ==================== 知识点饼图 ====================

/**
 * 创建或更新知识点掌握情况饼图
 */
function initKnowledgeChart(tags) {
  const ctx = document.getElementById('knowledgeChart');
  if (!ctx) {
    console.warn('知识点图表容器不存在');
    return;
  }

  // 销毁已存在的图表
  if (chartInstances.knowledgeChart) {
    chartInstances.knowledgeChart.destroy();
  }

  const labels = tags.map((t) => t.name);
  const data = tags.map((t) => t.value);

  // 颜色渐变
  const colors = [
    '#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#f43f5e',
    '#f97316', '#eab308', '#84cc16', '#22c55e', '#10b981',
    '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#8b5cf6',
  ];

  chartInstances.knowledgeChart = new Chart(ctx, {
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
            font: {
              size: 11,
            },
            padding: 15,
            usePointStyle: true,
          },
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 10,
          titleFont: {
            size: 12,
          },
          bodyFont: {
            size: 11,
          },
          cornerRadius: 4,
          callbacks: {
            label: function (context) {
              return context.label + ': ' + context.parsed + '%';
            },
          },
        },
      },
    },
  });
}

// ==================== 柱状图（可选） ====================

/**
 * 创建或更新柱状图
 * 用于显示知识点的题目数量对比
 */
function initTagCountChart(tags) {
  const ctx = document.getElementById('tagCountChart');
  if (!ctx) return;

  if (chartInstances.tagCountChart) {
    chartInstances.tagCountChart.destroy();
  }

  const labels = tags.map((t) => t.name);
  const counts = tags.map((t) => t.count || 0);

  chartInstances.tagCountChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: '完成题目数',
          data: counts,
          backgroundColor: 'rgba(99, 102, 241, 0.6)',
          borderColor: '#6366f1',
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
          },
        },
      },
    },
  });
}

// ==================== 导出函数 ====================

/**
 * 刷新所有图表
 */
function refreshAllCharts(stats) {
  if (stats.tags && stats.tags.length > 0) {
    initKnowledgeChart(stats.tags);
    initTagCountChart(stats.tags);
  }
}

/**
 * 销毁所有图表
 */
function destroyAllCharts() {
  Object.values(chartInstances).forEach((chart) => {
    if (chart) chart.destroy();
  });
  chartInstances = {};
}
