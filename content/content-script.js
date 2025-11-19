console.log("OJ助手内容脚本已注入！");

/**
 * UI 管理器 - 处理 AI 响应的显示
 */
class UIManager {
  constructor() {
    this.currentOverlay = null;
  }

  /**
   * 简单的Markdown解析器
   */
  parseMarkdown(markdown) {
    if (!markdown || typeof markdown !== 'string') {
      return markdown;
    }

    // 重置状态变量
    const lines = markdown.split('\n');
    let html = '';
    let inCodeBlock = false;
    let codeBlockContent = '';
    let inList = false;
    let listType = ''; // 'ul' or 'ol'
    let listItems = [];
    
    // 逐行处理Markdown内容
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      let originalLine = line; // 保留原始行用于识别
      
      // 首先检查是否是代码块的开始或结束（最高优先级）
      const isCodeBlockStart = line.trim().startsWith('```');
      const isCodeBlockEnd = line.trim() === '```';
      
      // 处理代码块状态转换
      if (isCodeBlockStart && !inCodeBlock) {
        // 代码块开始 - 可以包含语言标识
        inCodeBlock = true;
        codeBlockContent = '';
        continue;
      } else if (isCodeBlockEnd && inCodeBlock) {
        // 代码块结束 - 确保正确转义并添加
        const escapedCode = codeBlockContent
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
        html += `<pre><code>${escapedCode}</code></pre>\n`;
        inCodeBlock = false;
        continue;
      }
      
      // 如果在代码块内，直接累积内容（不进行任何其他处理）
      if (inCodeBlock) {
        // 保留原始行内容，不做任何Markdown处理
        codeBlockContent += originalLine + '\n';
        continue;
      }
      
      // 非代码块内容处理
      
      // 1. 首先处理标题（高优先级）
      const h1Match = line.match(/^#\s+(.*)$/);
      const h2Match = line.match(/^##\s+(.*)$/);
      const h3Match = line.match(/^###\s+(.*)$/);
      
      if (h1Match) {
        html += `<h1>${this.processInlineMarkdown(h1Match[1])}</h1>\n`;
        continue;
      } else if (h2Match) {
        html += `<h2>${this.processInlineMarkdown(h2Match[1])}</h2>\n`;
        continue;
      } else if (h3Match) {
        html += `<h3>${this.processInlineMarkdown(h3Match[1])}</h3>\n`;
        continue;
      }
      
      // 2. 处理列表项
      const ulMatch = line.match(/^\-\s+(.*)$/);
      const olMatch = line.match(/^(\d+)\.\s+(.*)$/);
      
      if (ulMatch || olMatch) {
        const currentListType = ulMatch ? 'ul' : 'ol';
        const content = ulMatch ? ulMatch[1] : olMatch[2];
        
        // 处理列表切换或开始
        if (!inList || listType !== currentListType) {
          if (inList) {
            // 结束当前列表
            html += `<${listType}>${listItems.join('')}</${listType}>\n`;
            listItems = [];
          }
          listType = currentListType;
          inList = true;
        }
        
        // 添加列表项（处理内部的Markdown格式）
        listItems.push(`<li>${this.processInlineMarkdown(content)}</li>`);
      } else {
        // 3. 不是列表项，如果之前在列表中，结束列表
        if (inList) {
          html += `<${listType}>${listItems.join('')}</${listType}>\n`;
          listItems = [];
          inList = false;
        }
        
        // 处理普通行
        if (line.trim()) {
          // 对普通文本应用行内Markdown处理（包括行内代码）
          html += `<p>${this.processInlineMarkdown(line)}</p>\n`;
        } else {
          // 空行保留
          html += '\n';
        }
      }
    }
    
    // 清理未闭合的列表
    if (inList) {
      html += `<${listType}>${listItems.join('')}</${listType}>\n`;
    }
    
    // 清理未闭合的代码块（异常情况处理）
    if (inCodeBlock && codeBlockContent) {
      const escapedCode = codeBlockContent
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
      html += `<pre><code>${escapedCode}</code></pre>\n`;
    }
    
    return html.trim();
  }
  
  /**
   * 处理行内Markdown格式
   */
  processInlineMarkdown(text) {
    // 先转义HTML特殊字符
    let processed = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    
    // 处理粗体和斜体（注意顺序，先处理双符号）
    processed = processed
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.*?)__/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/_(.*?)_/g, '<em>$1</em>');
    
    // 处理行内代码（单个反引号包裹的内容）
    processed = processed.replace(/`([^`]*)`/g, (match, code) => {
      // 确保代码内容被正确转义
      return `<code>${code}</code>`;
    });
    
    // 处理链接
    processed = processed.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    return processed;
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
    console.log('[UI Manager] 显示AI响应:', { feature, result });
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
    
    try {
      const renderedContent = this.renderResult(feature, result);
      console.log('[UI Manager] 渲染结果成功生成');
      body.innerHTML = renderedContent;
    } catch (e) {
      console.error('[UI Manager] 渲染结果失败:', e);
      body.innerHTML = `<div class="oj-helper-error">渲染失败: ${e.message}</div>`;
    }
    
    content.appendChild(body);
    overlay.appendChild(content);
    this.currentOverlay = overlay;
    console.log('[UI Manager] 响应UI已成功创建并显示');
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
    console.log('[UI Manager] 渲染结果 - 原始数据:', result);
    
    // 检查是否有content字段，如果有则优先使用content
    if (result && typeof result === 'object' && result.content !== undefined) {
      console.log('[UI Manager] 发现content字段，使用content进行渲染');
      return this.renderResult(feature, result.content);
    }
    
    if (typeof result === 'string') {
      console.log('[UI Manager] 渲染markdown内容');
      const htmlContent = this.parseMarkdown(result);
      return `<div class="oj-helper-text oj-helper-markdown">${htmlContent}</div>`;
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
        console.log('[UI Manager] 使用默认渲染方式');
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


(function () {
  if (document.getElementById("oj-helper-root")) return;

  // 先加载 UI 管理器
  let uiManager = null;
  
  // 确保UIManager类定义完整
  if (typeof UIManager === 'undefined') {
    console.error('[Content-Script] UIManager class not defined');
  }

  function loadUIManager() {
    return new Promise((resolve) => {
      if (uiManager) {
        resolve();
        return;
      }

      try {
        // 直接使用已定义的UIManager类创建实例
        uiManager = new UIManager();
        // 同时挂载到window对象上，保持兼容性
        window.uiManager = uiManager;
        console.log('[Content-Script] UIManager initialized directly');
      } catch (error) {
        console.error('[Content-Script] Failed to initialize UIManager:', error);
      }
      resolve();
    });
  }

  // 降级方案：如果 uiManager 未加载，使用简单的 alert
  function showLoading(message = 'AI 正在思考中...') {
    if (uiManager && uiManager.showLoading) {
      uiManager.showLoading(message);
    } else {
      console.log('[Content-Script] Loading:', message);
    }
  }

  function showResponse(feature, result) {
    console.log('[Content-Script] 调用showResponse:', { feature, uiManagerAvailable: !!uiManager });
    if (uiManager && uiManager.showResponse) {
      uiManager.showResponse(feature, result);
    } else {
      console.log('[Content-Script] Response (降级显示):', { feature, result });
      alert(`[${feature}]\n${JSON.stringify(result, null, 2)}`);
    }
  }

  function showError(message, error = null) {
    if (uiManager && uiManager.showError) {
      uiManager.showError(message, error);
    } else {
      console.error('[Content-Script] Error:', message, error);
      alert(`错误: ${message}`);
    }
  }

  const features = [
    { key: "guide", label: "问题引导" },
    { key: "hint", label: "思路提示" },
    { key: "fix", label: "代码纠错" },
    { key: "recommend", label: "知识推荐" }
  ];

  // 简单页面类型检测
  function detectPageType() {
    const href = location.href;
    if (/\/solution\//.test(href) || /\/submission\//.test(href)) return 'result';
    if (/\/submit\/?$/.test(href) || /\/submit\//.test(href) || document.querySelector('form[action*="submit"]') || document.querySelector('textarea') || document.querySelector('.CodeMirror')) return 'edit';
    // 检查是否有题面主体
    if (document.querySelector('dl.problem-content') || document.querySelector('#pageTitle') || document.querySelector('.problem-statistics')) return 'problem';
    return 'other';
  }

  function createMenu() {
    const root = document.createElement("div");
    root.id = "oj-helper-root";

    // 创建小猫元素替代按钮
    const main = document.createElement("div");
    main.id = "oj-helper-btn";
    main.className = "oj-helper-main";
    main.setAttribute("aria-haspopup", "true");
    main.setAttribute("aria-expanded", "false");
    main.title = "AI 助手";
    main.setAttribute("role", "button");
    main.setAttribute("tabindex", "0");
    
    // 加载小猫动画
    function loadKittenFrames(animationType = 'speaking') {
      const frameCount = 11; // 从0到10共11帧
      const frames = [];
      const directory = animationType === 'speaking' ? 'speaking_facing_left' : 'idle_facing_left';
      for (let i = 0; i < frameCount; i++) {
        const framePath = chrome.runtime.getURL(`assets/kitten/${directory}/pixil-frame-${i}.png`);
        frames.push(framePath);
      }
      return frames;
    }
    
    // 创建img元素用于显示小猫
    const kittenImg = document.createElement("img");
    kittenImg.className = "oj-helper-kitten";
    kittenImg.alt = "AI助手小猫";
    main.appendChild(kittenImg);
    
    // 实现小猫动画
    let currentAnimationType = 'idle'; // 初始为idle动画
    let frames = loadKittenFrames(currentAnimationType);
    let currentFrame = 0;
    
    // 添加点击事件监听器，在speaking和idle动画之间来回切换
    main.addEventListener('click', function() {
      // 在speaking和idle动画之间切换
      currentAnimationType = currentAnimationType === 'speaking' ? 'idle' : 'speaking';
      // 加载对应动画帧
      frames = loadKittenFrames(currentAnimationType);
      // 重置当前帧索引，确保从第一帧开始
      currentFrame = 0;
    });
    
    function animateKitten() {
      kittenImg.src = frames[currentFrame];
      currentFrame = (currentFrame + 1) % frames.length;
    }
    
    // 开始动画，每100毫秒切换一帧
    animateKitten(); // 立即显示第一帧
    const animationInterval = setInterval(animateKitten, 100);
    
    // 清理函数（当元素被移除时停止动画）
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          if (!document.body.contains(main)) {
            clearInterval(animationInterval);
            observer.disconnect();
            break;
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const menu = document.createElement("div");
    menu.className = "oj-helper-menu";

    // 检测页面类型
    const pageType = detectPageType();
    
    // 根据页面类型过滤可用的功能
    const availableFeatures = features.filter((f) => {
      if (f.key === 'guide') return pageType === 'problem'; //问题引导仅能在题目界面触发
      if (f.key === 'hint') return pageType === 'problem'; //思路提示仅能在题目界面触发
      if (f.key === 'fix') return pageType === 'result';  //代码纠错仅能在提交结果界面触发
      return true; // recommend 和 pet 在任何页面都可用
    });

    // 创建动作按钮（仅显示可用的功能）
    const actionButtons = availableFeatures.map((f) => {
      const b = document.createElement("button");
      b.className = "oj-helper-action";
      b.type = "button";
      b.tabIndex = 0;
      b.dataset.key = f.key;
      b.innerText = f.label;
      b.setAttribute("role", "button");
      b.setAttribute("aria-label", f.label);
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        // 切换回idle动画
        currentAnimationType = 'idle';
        // 加载idle动画帧
        frames = loadKittenFrames(currentAnimationType);
        // 重置当前帧索引，确保从第一帧开始
        currentFrame = 0;
        // 关闭菜单
        setExpanded(false);
        // 执行按钮功能
        onActionClick(f.key);
      });
      b.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          onActionClick(f.key);
        }
      });
      menu.appendChild(b);
      return b;
    });

    // 状态和行为控制
    let expanded = false;
    
    function setExpanded(val) {
      expanded = !!val;
      if (expanded) {
        menu.classList.add("expanded");
        main.setAttribute("aria-expanded", "true");
      } else {
        menu.classList.remove("expanded");
        main.setAttribute("aria-expanded", "false");
      }
    }

    // 点击切换菜单状态（所有设备统一处理）
    main.addEventListener("click", (e) => {
      e.stopPropagation(); // 防止点击事件冒泡
      setExpanded(!expanded);
    });
    
    // 点击文档其他区域关闭菜单并切换回idle动画
    document.addEventListener("click", () => {
      if (expanded) {
        setExpanded(false);
        // 切换回idle动画
        currentAnimationType = 'idle';
        // 加载idle动画帧
        frames = loadKittenFrames(currentAnimationType);
        // 重置当前帧索引，确保从第一帧开始
        currentFrame = 0;
      }
    });
    
    // 阻止菜单内部点击关闭菜单
    menu.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    // 键盘支持
    main.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setExpanded(!expanded);
        if (!expanded) {
          setTimeout(() => actionButtons[0]?.focus(), 0);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setExpanded(true);
        actionButtons[actionButtons.length - 1]?.focus();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setExpanded(true);
        actionButtons[0]?.focus();
      }
    });

    // close on Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setExpanded(false);
    });

    // 规范化题目基准路径：把 /.../submit/... 或 /.../solution/... 等后缀去掉，返回以 / 结尾的 pathname
    function normalizeProblemPath(href) {
      try {
        const u = new URL(href, location.origin);
        let p = u.pathname;
        // 去掉 /submit/..., /solution/..., /submission/... 等及其后缀
        p = p.replace(/\/(?:submit|solution|submission)(?:\/.*)?$/i, '/');
        // 如果路径没有以 / 结尾，补上
        if (!p.endsWith('/')) p = p + '/';
        return p;
      } catch (e) {
        try {
          let p = String(href || location.pathname);
          p = p.replace(/\/(?:submit|solution|submission)(?:\/.*)?$/i, '/');
          if (!p.endsWith('/')) p = p + '/';
          return p;
        } catch (e2) { return location.pathname; }
      }
    }

    // 从编辑器/页面获取当前代码（尽可能覆盖常见编辑器）
    function getCurrentCodeFromPage() {
      const ta = document.querySelector('textarea');
      if (ta && ta.value && ta.value.trim().length > 0) return ta.value;
      const cmEl = document.querySelector('.CodeMirror');
      if (cmEl && window.CodeMirror) {
        try { const cm = (cmEl.CodeMirror || window.CodeMirror); if (cm && typeof cm.getValue === 'function') return cm.getValue(); } catch (e) {}
      }
      const aceEl = document.querySelector('.ace_text-input'); if (aceEl && aceEl.value) return aceEl.value;
      const mon = document.querySelector('.monaco-editor textarea'); if (mon && mon.value) return mon.value;
      const codePre = document.querySelector('pre[class*="sh_"] , pre.sh_cpp, pre.code, .submission-code pre, .code pre');
      if (codePre) return codePre.innerText || codePre.textContent || '';
      return '';
    }

    // 在结果页尝试提取报错信息（编译/运行错误/评测信息）
    function extractErrorInfo() {
      // 优先抓取页面上专门的编译错误区域（例如编译错误标题后的 pre）
      const cePre = document.querySelector('h3.h3-compile-status + pre, .compile-info pre, pre.compile-error');
      if (cePre && (cePre.innerText || cePre.textContent || '').trim()) return (cePre.innerText || cePre.textContent || '').trim();
      // 其次尝试一些常见容器
      const selectors = ['.compile-error', '.judge-result', '.submission-result', '.error', '#judge-result'];
      for (const s of selectors) {
        const el = document.querySelector(s);
        if (el && (el.innerText||el.textContent||'').trim()) return (el.innerText||el.textContent||'').trim();
      }
      // fallback: 找到包含关键字的段
      const allText = (document.body.innerText || '').slice(0, 2000);
      if (/错误|Error|Compile|Runtime|WA|TLE|RTE/i.test(allText)) {
        const m = allText.match(/.{0,500}/);
        return m ? m[0] : allText;
      }
      return '';
    }

    // 点击动作时的处理
    function onActionClick(key) {
      console.log("AI 助手 action:", key);
      // 页面类型检查已在按钮创建时处理，此处无需再次检查
      
      // 确保在使用uiManager之前，loadUIManager()已经完成
      loadUIManager().then(() => {
        let maybe = null;
        try { maybe = getProblemContext(); } catch (e) { maybe = {}; }

      function fetchCachedFromBackground(path) {
        return new Promise((resolve) => {
          try {
            chrome.runtime.sendMessage({ action: 'get_cached_problem', path }, (resp) => {
              if (resp && resp.ok && resp.data) resolve({ source: 'background', data: resp.data, path: resp.path });
              else resolve(null);
            });
          } catch (e) { resolve(null); }
        });
      }

      const handleContext = async (context) => {
        if (!context) context = {};
        let usedSource = 'direct';
        let usedContext = context;
        
        if ((!context.statement || context.statement === '') && pageType !== 'problem') {
          const fromBg = await fetchCachedFromBackground(normalizeProblemPath(location.href));
          if (fromBg && fromBg.data) {
            usedSource = 'background';
            usedContext = fromBg.data;
          }
        }

        const currentCode = getCurrentCodeFromPage();
        const errorInfo = (pageType === 'result') ? extractErrorInfo() : '';

        const payload = {
          feature: key,
          pageType,
          title: String((usedContext && usedContext.title) ? usedContext.title : ''),
          statement: String((usedContext && usedContext.statement) ? usedContext.statement : ''),
          samples: (usedContext && usedContext.samples) ? usedContext.samples : [],
          currentCode: String(currentCode || (usedContext && usedContext.currentCode) || ''),
          tags: (usedContext && usedContext.tags) ? usedContext.tags : [],
          problemId: String((usedContext && usedContext.problemId) ? usedContext.problemId : ''),
          url: String((usedContext && usedContext.url) ? usedContext.url : location.href),
          error: String(errorInfo || ''),
          _debug_source: usedSource,
        };

        // 显示加载状态
        showLoading('AI 正在思考中...');

        try {
          const context_json = JSON.stringify(payload);
          chrome.runtime.sendMessage({ action: "invoke_feature", feature: key, context_json }, (resp) => {
            console.log("[Content-Script] background response:", resp);
            
            if (resp && resp.success) {
              // 显示 AI 响应
              showResponse(key, resp.result);
            } else {
              // 显示错误
              showError(
                resp?.error || '请求失败，请重试',
                resp?.error
              );
            }
          });
        } catch (e) {
          console.error('[Content-Script] 发送消息失败', e);
          showError('无法连接到 AI 服务，请确保后端已启动');
        }
      };

      if (maybe && typeof maybe.then === 'function') {
        maybe.then(handleContext).catch(e => { 
          console.warn('[Content-Script] 解析题面失败', e);
          showError('无法解析题目信息');
        });
      } else {
        handleContext(maybe);
      }

      // 点击菜单选项后收起菜单
      setExpanded(false);
        });
    }

    // 将解析逻辑拆分为可以对任意 Document 运行的函数（用于 fetch 回退解析）
    function parseProblemFromDocument(doc, allowGenericPre = true) {
      const ctx = {
        title: '',
        statement: '',
        samples: [],
        currentCode: '',
        tags: [],
        problemId: '',
        url: (doc && doc.location && doc.location.href) ? doc.location.href : location.href,
      };

      const pageTitle = doc.querySelector('#pageTitle h2') || doc.querySelector('.pageTitle h2') || doc.querySelector('h1');
      if (pageTitle && pageTitle.innerText.trim()) ctx.title = pageTitle.innerText.trim();
      if (!ctx.title && doc.title) ctx.title = doc.title.replace(/\s*-\s*OpenJudge.*$/i, '').trim();

      const dl = doc.querySelector('dl.problem-content');
      if (dl) {
        const dts = Array.from(dl.querySelectorAll('dt'));
        const samplesInputs = [];
        const samplesOutputs = [];
        dts.forEach(dt => {
          const key = (dt.innerText || '').trim();
          const dd = dt.nextElementSibling;
          if (!dd) return;
          const text = (dd.innerText || dd.textContent || '').trim();
          if (/^描述|^题面|描述/i.test(key)) {
            ctx.statement = text;
          } else if (/样例输入|Sample Input|样例/i.test(key)) {
            const pres = Array.from(dd.querySelectorAll('pre')).map(n => (n.innerText||n.textContent||'').trim()).filter(Boolean);
            if (pres.length) pres.forEach(p=>samplesInputs.push(p));
          } else if (/样例输出|Sample Output/i.test(key)) {
            const pres = Array.from(dd.querySelectorAll('pre')).map(n => (n.innerText||n.textContent||'').trim()).filter(Boolean);
            if (pres.length) pres.forEach(p=>samplesOutputs.push(p));
          }
        });

        const maxN = Math.max(samplesInputs.length, samplesOutputs.length);
        for (let i = 0; i < maxN; i++) {
          const s = { input: samplesInputs[i] || '', output: samplesOutputs[i] || '' };
          if (s.input || s.output) ctx.samples.push(s);
        }
      }

      if (ctx.samples.length === 0 && allowGenericPre) {
        const pres = Array.from(doc.querySelectorAll('dl.problem-content pre, pre'))
          .map(n => (n.innerText || n.textContent || '').trim())
          .filter(Boolean);
        if (pres.length >= 2) {
          for (let i = 0; i < pres.length; i += 2) {
            ctx.samples.push({ input: pres[i], output: pres[i+1] || '' });
          }
        } else if (pres.length === 1) {
          ctx.samples.push({ input: pres[0], output: '' });
        }
      }

      try {
        const statsDl = doc.querySelector('.problem-statistics dl');
        if (statsDl) {
          const dts = Array.from(statsDl.querySelectorAll('dt'));
          dts.forEach(dt => {
            const k = (dt.innerText||'').trim();
            const dd = dt.nextElementSibling;
            if (!dd) return;
            if (/全局题号|题号|Problem ID/i.test(k)) {
              ctx.problemId = (dd.innerText||dd.textContent||'').trim();
            }
          });
        }
      } catch (e) {}

      const tagContainer = doc.querySelector('#problem-tags') || doc.querySelector('.problem-tags') || doc.querySelector('.tags');
      if (tagContainer) {
        const items = Array.from(tagContainer.querySelectorAll('a,span,li')).map(n => (n.innerText||'').trim()).filter(Boolean);
        if (items.length) ctx.tags = items;
      } else {
        const meta = doc.querySelector('meta[name="keywords"]');
        if (meta && meta.content) ctx.tags = meta.content.split(',').map(s => s.trim()).filter(Boolean);
      }

      return ctx;
    }

    // 从当前页面（或通过解析远程页面）获取题目信息，优先使用页面内解析，再回退到 sessionStorage 或 fetch
    function getProblemContext() {
      const doc = document;
      const parsed = parseProblemFromDocument(doc, false);

      try {
        const href = location.href || '';
        const isResult = /\/solution\//.test(href) || /\/submission\//.test(href) || !!document.querySelector('h3.h3-compile-status');
        if (isResult) {
          try {
            let probHref = null;
            try {
              const dl = doc.querySelector('.compile-info dl');
              if (dl) {
                const dts = Array.from(dl.querySelectorAll('dt'));
                for (const dt of dts) {
                  if (/题目|Problem/i.test((dt.innerText||'').trim())) {
                    const dd = dt.nextElementSibling;
                    if (dd) {
                      const a = dd.querySelector('a');
                      if (a && a.getAttribute('href')) { probHref = new URL(a.getAttribute('href'), location.origin).href; break; }
                    }
                  }
                }
              }
            } catch (e) {}

            if (!probHref) {
              const a = doc.querySelector('.compile-info a[href*="/mooc2017problems/"], #side a[href*="/mooc2017problems/"], a[href*="/problems/"]');
              if (a && a.getAttribute('href')) probHref = new URL(a.getAttribute('href'), location.origin).href;
            }

            if (probHref) {
              return fetch(probHref, { credentials: 'include' }).then(r => r.text()).then(html => {
                const parser = new DOMParser();
                const doc2 = parser.parseFromString(html, 'text/html');
                const parsed2 = parseProblemFromDocument(doc2, true);
                try {
                  const refNorm = normalizeProblemPath(probHref);
                  const key = 'oj_problem_' + refNorm;
                  const payload = { ts: Date.now(), path: refNorm, data: parsed2 };
                  sessionStorage.setItem(key, JSON.stringify(payload));
                  sessionStorage.setItem('oj_last_problem', key);
                  try { chrome.runtime.sendMessage({ action: 'cache_problem', path: refNorm, data: parsed2 }); } catch (e) {}
                } catch (e) {}
                return Object.assign({}, parsed2, { url: probHref });
              }).catch(e => {
                console.warn('[Content-Script] fetch 题面失败', e);
                return parsed;
              });
            }

            const ref = document.referrer;
            if (ref && ref.includes(location.hostname)) {
              return fetch(ref, { credentials: 'include' }).then(r => r.text()).then(html => {
                const parser = new DOMParser();
                const doc2 = parser.parseFromString(html, 'text/html');
                const parsed2 = parseProblemFromDocument(doc2, true);
                try {
                  const refNorm = normalizeProblemPath(ref);
                  const key = 'oj_problem_' + refNorm;
                  const payload = { ts: Date.now(), path: refNorm, data: parsed2 };
                  sessionStorage.setItem(key, JSON.stringify(payload));
                  sessionStorage.setItem('oj_last_problem', key);
                  try { chrome.runtime.sendMessage({ action: 'cache_problem', path: refNorm, data: parsed2 }); } catch (e) {}
                } catch (e) {}
                return Object.assign({}, parsed2, { url: ref });
              }).catch(e => {
                console.warn('[Content-Script] referrer fetch 题面失败', e);
                return parsed;
              });
            }
          } catch (e) {}
        }
      } catch (e) {}

      if (parsed.statement || parsed.samples.length) {
        try {
          const norm = normalizeProblemPath(location.href);
          const key = 'oj_problem_' + norm;
          const payload = { ts: Date.now(), path: norm, data: parsed };
          sessionStorage.setItem(key, JSON.stringify(payload));
          sessionStorage.setItem('oj_last_problem', key);
        } catch (e) {}
        try {
          const norm = normalizeProblemPath(location.href);
          chrome.runtime.sendMessage({ action: 'cache_problem', path: norm, data: parsed }, (resp) => {});
        } catch (e) {}
        return Object.assign({}, parsed, { url: location.href });
      }

      try {
        const norm = normalizeProblemPath(location.href);
        const key = 'oj_problem_' + norm;
        const raw = sessionStorage.getItem(key);
        if (raw) {
          const obj = JSON.parse(raw);
          if (obj && obj.data) return Object.assign({}, obj.data, { url: obj.path || norm });
        }
      } catch (e) {}

      try {
        return new Promise((resolve) => {
          try {
            const norm = normalizeProblemPath(location.href);
            chrome.runtime.sendMessage({ action: 'get_cached_problem', path: norm }, (resp) => {
              if (resp && resp.ok && resp.data) {
                resolve(Object.assign({}, resp.data, { url: resp.path || norm }));
                return;
              }

              try {
                let probHref = null;
                try {
                  const dl = doc.querySelector('.compile-info dl');
                  if (dl) {
                    const dts = Array.from(dl.querySelectorAll('dt'));
                    for (const dt of dts) {
                      if (/题目|Problem/i.test((dt.innerText||'').trim())) {
                        const dd = dt.nextElementSibling;
                        if (dd) {
                          const a = dd.querySelector('a');
                          if (a && a.getAttribute('href')) { probHref = new URL(a.getAttribute('href'), location.origin).href; break; }
                        }
                      }
                    }
                  }
                } catch (e) {}

                if (!probHref) {
                  const a = doc.querySelector('.compile-info a[href*="/mooc"] , #side a[href*="/mooc"], .compile-info a[href*="/problems"]');
                  if (a && a.getAttribute('href')) probHref = new URL(a.getAttribute('href'), location.origin).href;
                }

                if (probHref) {
                  fetch(probHref, { credentials: 'include' }).then(r => r.text()).then(html => {
                    const parser = new DOMParser();
                    const doc2 = parser.parseFromString(html, 'text/html');
                    const parsed2 = parseProblemFromDocument(doc2, true);
                    try {
                      const refNorm = normalizeProblemPath(probHref);
                      const key = 'oj_problem_' + refNorm;
                      const payload = { ts: Date.now(), path: refNorm, data: parsed2 };
                      sessionStorage.setItem(key, JSON.stringify(payload));
                      sessionStorage.setItem('oj_last_problem', key);
                      try { chrome.runtime.sendMessage({ action: 'cache_problem', path: refNorm, data: parsed2 }); } catch (e) {}
                    } catch (e) {}
                    resolve(Object.assign({}, parsed2, { url: probHref }));
                  }).catch(e => {
                    console.warn('[Content-Script] fetch 题面失败', e);
                    resolve(parsed);
                  });
                } else {
                  const ref = document.referrer;
                  if (ref && ref.includes(location.hostname)) {
                    fetch(ref, { credentials: 'include' }).then(r => r.text()).then(html => {
                      const parser = new DOMParser();
                      const doc2 = parser.parseFromString(html, 'text/html');
                      const parsed2 = parseProblemFromDocument(doc2, true);
                      try {
                        const refNorm = normalizeProblemPath(ref);
                        const key = 'oj_problem_' + refNorm;
                        const payload = { ts: Date.now(), path: refNorm, data: parsed2 };
                        sessionStorage.setItem(key, JSON.stringify(payload));
                        sessionStorage.setItem('oj_last_problem', key);
                        try { chrome.runtime.sendMessage({ action: 'cache_problem', path: refNorm, data: parsed2 }); } catch (e) {}
                      } catch (e) {}
                      resolve(Object.assign({}, parsed2, { url: ref }));
                    }).catch(e => {
                      console.warn('[Content-Script] fetch 题面失败', e);
                      resolve(parsed);
                    });
                  } else {
                    resolve(parsed);
                  }
                }
              } catch (e) { resolve(parsed); }
            });
          } catch (e) {
            try {
              const ref = document.referrer;
              if (ref && ref.includes(location.hostname)) {
                fetch(ref, { credentials: 'include' }).then(r => r.text()).then(html => {
                  const parser = new DOMParser();
                  const doc2 = parser.parseFromString(html, 'text/html');
                  const parsed2 = parseProblemFromDocument(doc2, true);
                  resolve(Object.assign({}, parsed2, { url: ref }));
                }).catch(() => resolve(parsed));
              } else resolve(parsed);
            } catch (e2) { resolve(parsed); }
          }
        });
      } catch (e) {}

      return parsed;
    }

    // Utility
    function isTouchDevice() {
      return (('ontouchstart' in window) || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0);
    }

    // 把元素插到页面
    root.appendChild(menu);
    root.appendChild(main);
    document.body.appendChild(root);

    // Load CSS from extension if not already
    const cssHref = chrome.runtime.getURL('content/style.css');
    if (!document.querySelector(`link[href="${cssHref}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = cssHref;
      document.head.appendChild(link);
    }

    // 加载 UI 管理器脚本
    loadUIManager().then(() => {
      console.log('[Content-Script] Setup complete');
    });
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    createMenu();
  } else {
    window.addEventListener("load", createMenu);
  }

})();
