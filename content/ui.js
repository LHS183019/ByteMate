/**
 * UI 管理器 - 处理 AI 响应的显示
 */
class UIManager {
  constructor() {
    this.currentOverlay = null;
  }

  /**
   * 显示加载状态
   */
  showLoading(message = 'AI 正在思考中...') {
    this.hideOverlay();
    const overlay = this.createOverlay();
    const content = document.createElement('div');
    content.className = 'oj-helper-content';
    content.innerHTML = `
      <div class="oj-helper-loading">
        <div class="oj-helper-spinner"></div>
        <p>${message}</p>
      </div>
    `;
    overlay.appendChild(content);
    this.currentOverlay = overlay;
  }

  /**
   * 显示 AI 响应
   */
  showResponse(feature, result) {
    this.hideOverlay();
    const overlay = this.createOverlay();
    const content = document.createElement('div');
    content.className = 'oj-helper-content';

    const header = document.createElement('div');
    header.className = 'oj-helper-header';
    header.innerHTML = `<h2>${this.getFeatureTitle(feature)}</h2>`;
    content.appendChild(header);

    const body = document.createElement('div');
    body.className = 'oj-helper-body';
    body.innerHTML = this.renderResult(feature, result);
    content.appendChild(body);

    overlay.appendChild(content);
    this.currentOverlay = overlay;
  }

  /**
   * 显示错误信息
   */
  showError(message, error = null) {
    this.hideOverlay();
    const overlay = this.createOverlay();
    const content = document.createElement('div');
    content.className = 'oj-helper-content';
    content.innerHTML = `
      <div class="oj-helper-error">
        <h2>❌ 出错了</h2>
        <p>${message}</p>
        ${error ? `<pre>${String(error).substring(0, 500)}</pre>` : ''}
      </div>
    `;
    overlay.appendChild(content);
    this.currentOverlay = overlay;
  }

  /**
   * 隐藏覆盖层
   */
  hideOverlay() {
    if (this.currentOverlay) {
      this.currentOverlay.remove();
      this.currentOverlay = null;
    }
  }

  /**
   * 创建基础覆盖层
   */
  createOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'oj-helper-overlay';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'oj-helper-close';
    closeBtn.innerHTML = '✕';
    closeBtn.type = 'button';
    closeBtn.addEventListener('click', () => this.hideOverlay());
    overlay.appendChild(closeBtn);

    document.body.appendChild(overlay);
    return overlay;
  }

  /**
   * 渲染结果内容
   */
  renderResult(feature, result) {
    if (typeof result === 'string') {
      return `<div class="oj-helper-text">${this.escapeHtml(result)}</div>`;
    }

    if (typeof result !== 'object') {
      return `<div class="oj-helper-text">${this.escapeHtml(String(result))}</div>`;
    }

    // 不同类型的结果渲染方式不同
    switch (feature) {
      case 'guide':
        return this.renderGuide(result);
      case 'hint':
      case 'idea':
        return this.renderIdea(result);
      case 'fix':
        return this.renderCodeFix(result);
      case 'recommend':
      case 'knowledge_tag':
        return this.renderKnowledge(result);
      default:
        return `<pre>${JSON.stringify(result, null, 2)}</pre>`;
    }
  }

  /**
   * 渲染问题引导
   */
  renderGuide(data) {
    const content = [];
    content.push('<div class="oj-helper-guide">');

    if (data.steps && Array.isArray(data.steps)) {
      content.push('<h3>思考步骤：</h3><ol>');
      data.steps.forEach((step, i) => {
        content.push(`<li>${this.escapeHtml(step)}</li>`);
      });
      content.push('</ol>');
    }

    if (data.keyPoints && Array.isArray(data.keyPoints)) {
      content.push('<h3>关键点：</h3><ul>');
      data.keyPoints.forEach((point) => {
        content.push(`<li>${this.escapeHtml(point)}</li>`);
      });
      content.push('</ul>');
    }

    if (data.suggestedApproach) {
      content.push(`<h3>建议方向：</h3><p>${this.escapeHtml(data.suggestedApproach)}</p>`);
    }

    content.push('</div>');
    return content.join('');
  }

  /**
   * 渲染思路提示
   */
  renderIdea(data) {
    const content = [];
    content.push('<div class="oj-helper-idea">');

    if (data.overview) {
      content.push(`<h3>总体思路：</h3><p>${this.escapeHtml(data.overview)}</p>`);
    }

    if (data.approaches && Array.isArray(data.approaches)) {
      content.push('<h3>多种方案对比：</h3><div class="approaches">');
      data.approaches.forEach((approach, i) => {
        content.push(`
          <div class="approach">
            <h4>${this.escapeHtml(approach.name || `方案 ${i + 1}`)}</h4>
            <p><strong>时间复杂度：</strong> ${this.escapeHtml(approach.timeComplexity || 'N/A')}</p>
            <p><strong>空间复杂度：</strong> ${this.escapeHtml(approach.spaceComplexity || 'N/A')}</p>
            <p>${this.escapeHtml(approach.description || '')}</p>
          </div>
        `);
      });
      content.push('</div>');
    }

    if (data.pseudocode) {
      content.push(`<h3>伪代码：</h3><pre>${this.escapeHtml(data.pseudocode)}</pre>`);
    }

    if (data.recommendation) {
      content.push(`<h3>推荐方案：</h3><p>${this.escapeHtml(data.recommendation)}</p>`);
    }

    content.push('</div>');
    return content.join('');
  }

  /**
   * 渲染代码纠错
   */
  renderCodeFix(data) {
    const content = [];
    content.push('<div class="oj-helper-fix">');

    if (data.hasErrors) {
      content.push('<h3>❌ 发现问题：</h3>');

      if (data.errors && Array.isArray(data.errors)) {
        content.push('<div class="errors">');
        data.errors.forEach((err) => {
          const severity = err.severity || 'error';
          const icon = severity === 'error' ? '❌' : '⚠️';
          content.push(`
            <div class="error error-${severity}">
              <p><strong>${icon} ${this.escapeHtml(err.title || '错误')}</strong></p>
              <p>位置：${this.escapeHtml(err.location || 'N/A')}</p>
              <p>${this.escapeHtml(err.description || '')}</p>
            </div>
          `);
        });
        content.push('</div>');
      }
    } else {
      content.push('<h3>✅ 代码看起来没有问题！</h3>');
    }

    if (data.improvements && Array.isArray(data.improvements)) {
      content.push('<h3>优化建议：</h3><div class="improvements">');
      data.improvements.forEach((imp) => {
        content.push(`
          <div class="improvement">
            <p><strong>${this.escapeHtml(imp.title || '优化')}</strong></p>
            <p>${this.escapeHtml(imp.suggestion || '')}</p>
          </div>
        `);
      });
      content.push('</div>');
    }

    content.push('</div>');
    return content.join('');
  }

  /**
   * 渲染知识点推荐
   */
  renderKnowledge(data) {
    const content = [];
    content.push('<div class="oj-helper-knowledge">');

    if (data.tags && Array.isArray(data.tags)) {
      content.push('<h3>涉及知识点：</h3><div class="tags">');
      data.tags.forEach((category) => {
        content.push(`<div class="tag-category"><strong>${this.escapeHtml(category.category)}</strong>:`);
        if (category.items && Array.isArray(category.items)) {
          category.items.forEach((item) => {
            const relevanceIcon = item.relevance === '高' ? '🔴' : item.relevance === '中' ? '🟡' : '🟢';
            content.push(`
              <span class="tag-item relevance-${item.relevance}">
                ${relevanceIcon} ${this.escapeHtml(item.name)}
              </span>
            `);
          });
        }
        content.push('</div>');
      });
      content.push('</div>');
    }

    if (data.learningPath) {
      content.push(`<h3>学习路径：</h3><p>${this.escapeHtml(data.learningPath)}</p>`);
    }

    if (data.relatedProblems && Array.isArray(data.relatedProblems)) {
      content.push('<h3>相关题目：</h3><ul>');
      data.relatedProblems.forEach((prob) => {
        content.push(`<li>${this.escapeHtml(prob)}</li>`);
      });
      content.push('</ul>');
    }

    content.push('</div>');
    return content.join('');
  }

  /**
   * 获取功能标题
   */
  getFeatureTitle(feature) {
    const titles = {
      guide: '📚 问题引导',
      hint: '💡 思路提示',
      idea: '💡 思路提示',
      fix: '🔧 代码纠错',
      recommend: '📖 知识推荐',
      knowledge_tag: '📖 知识推荐',
    };
    return titles[feature] || '💬 AI 回复';
  }

  /**
   * HTML 转义
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// 导出到全局作用域
window.uiManager = new UIManager();
console.log('[UIManager] Loaded and attached to window');
