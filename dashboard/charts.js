/**
 * 图表绘制模块
 * 基于 Chart.js 的各类数据可视化
 */

// ==================== 全局图表实例 ====================

let chartInstances = {
  trendChart: null,
  knowledgeChart: null,
};

// ==================== 趋势图表 ====================

/**
 * 创建或更新趋势图表
 * 显示最近 7 天的完成题目数和学习时长
 */
function initTrendChart(data) {
  const ctx = document.getElementById('trendChart');
  if (!ctx) {
    console.warn('趋势图表容器不存在');
    return;
  }

  // 销毁已存在的图表
  if (chartInstances.trendChart) {
    chartInstances.trendChart.destroy();
  }

  const dates = data.map((d) => d.date.split('-')[2]); // 只显示日期
  const completed = data.map((d) => d.completedCount);
  const hours = data.map((d) => Math.round((d.duration / 3600) * 10) / 10); // 转换为小时

  chartInstances.trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates.map((d) => `${d}日`),
      datasets: [
        {
          label: '完成题目数',
          data: completed,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          borderWidth: 2.5,
          fill: true,
          tension: 0.4,
          pointRadius: 5,
          pointBackgroundColor: '#6366f1',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          yAxisID: 'y',
        },
        {
          label: '学习时长 (小时)',
          data: hours,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 2.5,
          fill: true,
          tension: 0.4,
          pointRadius: 5,
          pointBackgroundColor: '#10b981',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
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
          labels: {
            font: {
              size: 12,
            },
            padding: 15,
            usePointStyle: true,
          },
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          titleFont: {
            size: 12,
          },
          bodyFont: {
            size: 11,
          },
          cornerRadius: 4,
          callbacks: {
            title: (context) => `${context[0].label}`,
            label: (context) => {
              let label = context.dataset.label || '';
              if (label) label += ': ';
              label += context.parsed.y;
              if (context.dataset.label === '学习时长 (小时)') {
                label += ' h';
              }
              return label;
            },
          },
        },
      },
      scales: {
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: '完成题目数',
            font: {
              size: 12,
            },
          },
          beginAtZero: true,
          max: Math.max(...completed) + 2,
          ticks: {
            stepSize: 1,
          },
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: '学习时长 (小时)',
            font: {
              size: 12,
            },
          },
          beginAtZero: true,
          grid: {
            drawOnChartArea: false,
          },
        },
      },
    },
  });
}

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
  if (stats.recentDays && stats.recentDays.length > 0) {
    initTrendChart(stats.recentDays);
  }

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
