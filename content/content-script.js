console.log("OJ助手内容脚本已注入！");

// 学习数据记录器
class LearningTracker {
  constructor() {
    this.sessionStartTime = Date.now();
    this.problemsAttempted = new Set();
    this.setupTracking();
  }

  setupTracking() {
    // 监控页面变化，检测AC状态
    this.observePageChanges();
    // 监控代码提交
    this.observeSubmissions();
    // 定期记录学习时长
    this.startTimeTracking();
  }

  observePageChanges() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          this.checkForACStatus();
        }
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  checkForACStatus() {
    // 检查是否有AC状态显示
    const acIndicators = [
      '.judge-result:contains("Accept")',
      '.submission-result:contains("AC")',
      'td:contains("Accepted")',
      '.status:contains("正确")',
      '.result:contains("AC")'
    ];
    
    for (const selector of acIndicators) {
      const element = document.querySelector(selector.split(':')[0]);
      if (element && (element.textContent.includes('Accept') || 
          element.textContent.includes('AC') || 
          element.textContent.includes('正确'))) {
        this.recordProblemSolved();
        break;
      }
    }
  }

  observeSubmissions() {
    // 监控提交表单
    const submitForms = document.querySelectorAll('form[action*="submit"]');
    submitForms.forEach(form => {
      form.addEventListener('submit', () => {
        this.recordAttempt();
      });
    });
  }

  startTimeTracking() {
    // 每5分钟记录一次学习时长
    setInterval(() => {
      this.recordLearningTime();
    }, 5 * 60 * 1000);
    
    // 页面关闭时记录时长
    window.addEventListener('beforeunload', () => {
      this.recordLearningTime();
    });
  }

  async recordProblemSolved() {
    try {
      const problemId = this.extractProblemId();
      if (problemId && !this.problemsAttempted.has(problemId)) {
        this.problemsAttempted.add(problemId);
        
        // 发送消息给background记录数据
        chrome.runtime.sendMessage({
          action: 'record_problem_solved',
          problemId: problemId,
          timestamp: Date.now()
        });
        
        console.log('[LearningTracker] 记录题目完成:', problemId);
      }
    } catch (error) {
      console.error('[LearningTracker] 记录题目完成失败:', error);
    }
  }

  async recordAttempt() {
    try {
      const problemId = this.extractProblemId();
      if (problemId) {
        chrome.runtime.sendMessage({
          action: 'record_attempt',
          problemId: problemId,
          timestamp: Date.now()
        });
        
        console.log('[LearningTracker] 记录题目尝试:', problemId);
      }
    } catch (error) {
      console.error('[LearningTracker] 记录题目尝试失败:', error);
    }
  }

  async recordLearningTime() {
    try {
      const currentTime = Date.now();
      const duration = Math.floor((currentTime - this.sessionStartTime) / 1000);
      
      if (duration > 0) {
        chrome.runtime.sendMessage({
          action: 'record_learning_time',
          duration: duration,
          timestamp: currentTime
        });
        
        // 重置会话开始时间
        this.sessionStartTime = currentTime;
        console.log('[LearningTracker] 记录学习时长:', duration, '秒');
      }
    } catch (error) {
      console.error('[LearningTracker] 记录学习时长失败:', error);
    }
  }

  extractProblemId() {
    // 从URL或页面内容提取题目ID
    const url = location.href;
    
    // 从URL提取
    const urlMatch = url.match(/\/problems?\/([^\/?]+)|\/mooc2017problems\/([^\/?]+)/i);
    if (urlMatch) {
      return urlMatch[1] || urlMatch[2];
    }
    
    // 从页面内容提取
    const titleElement = document.querySelector('#pageTitle h2, .pageTitle h2, h1');
    if (titleElement) {
      const titleMatch = titleElement.textContent.match(/([A-Z]?\d+[A-Z]?):?/);
      if (titleMatch) {
        return titleMatch[1];
      }
    }
    
    // 从统计信息提取
    const statElements = document.querySelectorAll('.problem-statistics dt');
    for (const dt of statElements) {
      if (dt.textContent.includes('题号') || dt.textContent.includes('Problem ID')) {
        const dd = dt.nextElementSibling;
        if (dd) {
          return dd.textContent.trim();
        }
      }
    }
    
    return null;
  }
}

// 初始化学习追踪器
const learningTracker = new LearningTracker();

/**
 * UI 管理器 - 处理 AI 响应的显示 (侧边栏 + 流式)
 */
class UIManager {
  constructor() {
    this.sidebar = null;
    this.contentArea = null;
    this.currentStreamContent = '';
    this.isStreaming = false;
    this.lastResponseFeature = null;
    this.lastResponseData = null;
    this.currentStreamTarget = null;
    this.currentLevel = 0;
    this.onContinue = null;
    
    // 流式分段处理相关
    this.fullContent = '';
    this.sections = [];
    this.currentSectionIndex = 0;
    this.waitingForContinue = false;
    // 使用更宽松的正则匹配分隔符，匹配任意空白字符包裹的标记
    // 更新为 __NEXT_STEP__ 以避免 Markdown 干扰
    this.SEPARATOR_REGEX = /\s*__NEXT_STEP__\s*/;
    
    this.currentRequestId = 0;
    this.activePort = null; // 当前活动的端口连接
    this.closeTimer = null;
    this.onReload = null;
    this.currentFeature = null; // 当前正在使用的功能类型
    
    // 历史记录存储相关
    this.historyStorageKey = 'oj_helper_history';
    this.loadHistoryFromStorage();
    
    // 页面类型映射
    this.pageTypeFeatureMap = {
      'problem': ['guide'],
      'submit': ['hint', 'idea'],
      'result': ['fix']
    };
  }
  
  // 获取当前页面类型
  getCurrentPageType() {
    const href = location.href;
    if (/\/solution\//.test(href) || /\/submission\//.test(href)) {
      return 'result';
    } else if (/\/submit\/?$/.test(href) || /\/submit\//.test(href)) {
      return 'submit';
    } else if (document.querySelector('dl.problem-content') || document.querySelector('#pageTitle') || document.querySelector('.problem-statistics')) {
      return 'problem';
    } else {
      return 'other';
    }
  }
  
  // 从本地存储加载历史记录
  loadHistoryFromStorage() {
    try {
      const stored = localStorage.getItem(this.historyStorageKey);
      if (stored) {
        this.history = JSON.parse(stored);
      } else {
        this.history = {};
      }
    } catch (error) {
      console.error('[UIManager] 加载历史记录失败:', error);
      this.history = {};
    }
  }
  
  // 保存历史记录到本地存储
  saveHistoryToStorage() {
    try {
      localStorage.setItem(this.historyStorageKey, JSON.stringify(this.history));
    } catch (error) {
      console.error('[UIManager] 保存历史记录失败:', error);
    }
  }
  
  // 保存特定页面类型和功能的历史记录
  saveHistory(pageType, feature, data) {
    if (!this.history[pageType]) {
      this.history[pageType] = {};
    }
    this.history[pageType][feature] = {
      data: data,
      timestamp: Date.now()
    };
    this.saveHistoryToStorage();
  }
  
  // 获取特定页面类型的最新历史记录
  getLatestHistoryByPageType(pageType) {
    if (!this.history[pageType]) {
      return null;
    }
    
    const features = this.pageTypeFeatureMap[pageType] || [];
    let latestHistory = null;
    let latestTime = 0;
    
    for (const feature of features) {
      if (this.history[pageType][feature] && this.history[pageType][feature].timestamp > latestTime) {
        latestHistory = {
          feature: feature,
          data: this.history[pageType][feature].data
        };
        latestTime = this.history[pageType][feature].timestamp;
      }
    }
    
    return latestHistory;
  }

  /**
   * 简单的Markdown解析器
   */
  parseMarkdown(markdown) {
    if (!markdown || typeof markdown !== 'string') return markdown;

    const lines = markdown.split('\n');
    let html = '';
    let inCodeBlock = false;
    let codeBlockContent = '';
    let inList = false;
    let listType = ''; 
    let listItems = [];
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      let originalLine = line;
      
      const isCodeBlockStart = line.trim().startsWith('```');
      const isCodeBlockEnd = line.trim() === '```';
      
      if (isCodeBlockStart && !inCodeBlock) {
        inCodeBlock = true;
        codeBlockContent = '';
        continue;
      } else if (isCodeBlockEnd && inCodeBlock) {
        const escapedCode = codeBlockContent
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        // 包装在 oj-helper-code-block 中，以便后续添加复制按钮
        html += `<div class="oj-helper-code-block"><pre><code>${escapedCode}</code></pre></div>\n`;
        inCodeBlock = false;
        continue;
      }
      
      if (inCodeBlock) {
        codeBlockContent += originalLine + '\n';
        continue;
      }
      
      // 非代码块内容处理
      
      // 1. 首先处理分割线
      const hrMatch = line.match(/^---$/);
      if (hrMatch) {
        html += `<hr>\n`;
        continue;
      }
      
      // 2. 然后处理标题
      const h1Match = line.match(/^#\s+(.*)$/);
      const h2Match = line.match(/^##\s+(.*)$/);
      const h3Match = line.match(/^###\s+(.*)$/);
      const h4Match = line.match(/^####\s+(.*)$/);
      
      if (h1Match) {
        html += `<h1>${this.processInlineMarkdown(h1Match[1])}</h1>\n`;
        continue;
      } else if (h2Match) {
        html += `<h2>${this.processInlineMarkdown(h2Match[1])}</h2>\n`;
        continue;
      } else if (h3Match) {
        html += `<h3>${this.processInlineMarkdown(h3Match[1])}</h3>\n`;
        continue;
      } else if (h4Match) {
        html += `<h4>${this.processInlineMarkdown(h4Match[1])}</h4>\n`;
        continue;
      }
      
      const ulMatch = line.match(/^\-\s+(.*)$/);
      const olMatch = line.match(/^(\d+)\.\s+(.*)$/);
      
      if (ulMatch || olMatch) {
        const currentListType = ulMatch ? 'ul' : 'ol';
        const content = ulMatch ? ulMatch[1] : olMatch[2];
        
        if (!inList || listType !== currentListType) {
          if (inList) { html += `<${listType}>${listItems.join('')}</${listType}>\n`; listItems = []; }
          listType = currentListType;
          inList = true;
        }
        listItems.push(`<li>${this.processInlineMarkdown(content)}</li>`);
      } else {
        if (inList) {
          html += `<${listType}>${listItems.join('')}</${listType}>\n`;
          listItems = [];
          inList = false;
        }
        if (line.trim()) {
          html += `<p>${this.processInlineMarkdown(line)}</p>\n`;
        } else {
          html += '\n';
        }
      }
    }
    
    if (inList) html += `<${listType}>${listItems.join('')}</${listType}>\n`;
    if (inCodeBlock && codeBlockContent) {
      const escapedCode = codeBlockContent
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      html += `<div class="oj-helper-code-block"><pre><code>${escapedCode}</code></pre></div>\n`;
    }
    
    return html.trim();
  }

  // 为代码块添加复制按钮
  addCopyButtons(container) {
    if (!container) return;
    const blocks = container.querySelectorAll('.oj-helper-code-block');
    blocks.forEach(block => {
      if (block.querySelector('.oj-helper-copy-btn')) return; // 已添加

      const btn = document.createElement('button');
      btn.className = 'oj-helper-copy-btn';
      btn.textContent = '复制';
      btn.onclick = async () => {
        try {
          // 获取代码元素
          const codeElement = block.querySelector('code');
          if (!codeElement) {
            throw new Error('未找到代码元素');
          }
          
          // 获取代码内容
          const code = codeElement.innerText;
          if (!code.trim()) {
            throw new Error('代码内容为空');
          }
          
          // 尝试使用现代浏览器的剪贴板API
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(code);
          } else {
            // 备用方案：创建临时textarea元素
            const textarea = document.createElement('textarea');
            textarea.value = code;
            // 设置样式确保元素不可见但可访问
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            textarea.style.top = '-9999px';
            textarea.style.width = '2em';
            textarea.style.height = '2em';
            textarea.style.padding = '0';
            textarea.style.border = 'none';
            textarea.style.outline = 'none';
            textarea.style.boxShadow = 'none';
            textarea.style.background = 'transparent';
            document.body.appendChild(textarea);
            
            // 选择文本
            textarea.select();
            textarea.setSelectionRange(0, code.length);
            
            // 使用document.execCommand复制
            const success = document.execCommand('copy');
            document.body.removeChild(textarea);
            
            if (!success) {
              throw new Error('复制失败，请手动复制');
            }
          }
          
          // 显示复制成功状态
          btn.textContent = '已复制';
          btn.classList.add('copied');
          
          // 发送复制遥测
          chrome.runtime.sendMessage({
            action: 'copy_code',
            data: {
              timestamp: Date.now(),
              length: code.length
            }
          });

          // 2秒后恢复原始状态
          setTimeout(() => {
            btn.textContent = '复制';
            btn.classList.remove('copied');
          }, 2000);
        } catch (error) {
          console.error('复制失败:', error);
          
          // 显示错误状态
          const originalText = btn.textContent;
          btn.textContent = '复制失败';
          btn.classList.add('error');
          
          // 2秒后恢复原始状态
          setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.remove('error');
          }, 2000);
        }
      };
      block.appendChild(btn);
    });
  }
  
  processInlineMarkdown(text) {
    let processed = text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    
    processed = processed
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.*?)__/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/_(.*?)_/g, '<em>$1</em>');
    
    processed = processed.replace(/`([^`]*)`/g, (match, code) => `<code>${code}</code>`);
    processed = processed.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    return processed;
  }

  createSidebar() {
    if (this.sidebar) {
      this.sidebar.classList.add('visible');
      return this.sidebar;
    }

    const sidebar = document.createElement('div');
    sidebar.className = 'oj-helper-sidebar';
    
    const header = document.createElement('div');
    header.className = 'oj-helper-sidebar-header';
    
    const title = document.createElement('h2');
    title.className = 'oj-helper-sidebar-title';
    title.textContent = 'AI 助手';
    
    const controls = document.createElement('div');
    controls.className = 'oj-helper-sidebar-controls';
    
    // 重新加载按钮
    const reloadBtn = document.createElement('button');
    reloadBtn.className = 'oj-helper-sidebar-reload';
    reloadBtn.innerHTML = '↻';
    reloadBtn.title = '重新生成';
    reloadBtn.onclick = () => {
        this.regenerate();
    };

    // 收起按钮
    const collapseBtn = document.createElement('button');
    collapseBtn.className = 'oj-helper-sidebar-collapse';
    collapseBtn.innerHTML = '✕'; // 使用叉号作为收起图标
    collapseBtn.title = '收起';
    collapseBtn.onclick = () => this.collapseSidebar();

    // 关闭按钮 (已移除，功能合并到收起)
    // const closeBtn = document.createElement('button');
    // closeBtn.className = 'oj-helper-sidebar-close';
    // closeBtn.innerHTML = '✕';
    // closeBtn.title = '关闭';
    // closeBtn.onclick = () => this.closeSidebar();
    
    controls.appendChild(reloadBtn);
    controls.appendChild(collapseBtn);
    // controls.appendChild(closeBtn);
    header.appendChild(title);
    header.appendChild(controls);
    
    const content = document.createElement('div');
    content.className = 'oj-helper-sidebar-content';
    this.contentArea = content;
    
    sidebar.appendChild(header);
    sidebar.appendChild(content);
    
    document.body.appendChild(sidebar);
    
    // Animation
    requestAnimationFrame(() => sidebar.classList.add('visible'));
    
    this.sidebar = sidebar;
    return sidebar;
  }

  collapseSidebar() {
    if (this.sidebar) {
      this.sidebar.classList.remove('visible');
      // 不移除 DOM，保留状态
    }
  }

  closeSidebar() {
    if (this.sidebar) {
      this.sidebar.classList.remove('visible');
      
      if (this.closeTimer) clearTimeout(this.closeTimer);
      
      this.closeTimer = setTimeout(() => {
        if (this.sidebar) {
          this.sidebar.remove();
          this.sidebar = null;
          this.contentArea = null;
        }
        this.closeTimer = null;
      }, 400); // 匹配 CSS transition 时长
    }
  }

  showLoading(message = 'AI 正在思考中...') {
    // 取消可能的关闭操作
    if (this.closeTimer) {
        clearTimeout(this.closeTimer);
        this.closeTimer = null;
    }
    
    this.createSidebar();
    this.contentArea.innerHTML = `
      <div class="oj-helper-loading-indicator">
        <span>${message}</span>
      </div>
    `;
    this.isStreaming = true;
    this.currentStreamContent = '';
  }

  initResponse(feature) {
    // 1. 取消可能的关闭操作和定时器
    if (this.closeTimer) {
        clearTimeout(this.closeTimer);
        this.closeTimer = null;
    }

    // 2. 重置所有流式处理相关状态
    this.fullContent = '';
    this.sections = [];
    this.currentSectionIndex = 0;
    this.waitingForContinue = false;
    this.isStreaming = true;
    this.lastResponseData = null;
    
    // 3. 生成新的请求ID（确保旧请求的响应被忽略）
    this.currentRequestId = Date.now();
    
    // 4. 重新创建UI
    this.createSidebar();
    this.contentArea.innerHTML = ''; // 清空所有内容
    
    const responseContainer = document.createElement('div');
    responseContainer.className = 'oj-helper-response';
    
    // 创建第一个内容块
    const contentDiv = document.createElement('div');
    contentDiv.className = 'oj-helper-markdown-body section-0';
    responseContainer.appendChild(contentDiv);
    
    this.contentArea.appendChild(responseContainer);
    this.currentStreamTarget = contentDiv;
    this.lastResponseFeature = feature;
    this.currentFeature = feature; // 更新当前功能类型
    
    return this.currentRequestId;
  }

  appendStreamContent(chunk, requestId) {
    // 如果请求ID不匹配（说明是旧的流），则忽略
    if (requestId && requestId !== this.currentRequestId) return;
    
    if (!this.isStreaming) return;
    
    // 检查用户是否在底部（允许100px的误差），如果是，则在更新内容后自动滚动
    // 增加空值检查
    if (!this.contentArea) return;
    const isNearBottom = this.contentArea.scrollHeight - this.contentArea.scrollTop - this.contentArea.clientHeight < 100;

    this.fullContent += chunk;
    
    // 分割内容
    const parts = this.fullContent.split(this.SEPARATOR_REGEX);
    this.sections = parts;
    
    // 检查是否已经接收到了下一部分的内容
    if (this.sections.length > this.currentSectionIndex + 1) {
        // 我们已经跨越了边界，确保当前部分完整渲染
        const currentSectionContent = this.sections[this.currentSectionIndex];
        if (this.currentStreamTarget) {
            this.currentStreamTarget.innerHTML = this.parseMarkdown(currentSectionContent);
            this.addCopyButtons(this.currentStreamTarget);
        }
        
        // 如果还没有显示继续按钮，则显示
        if (!this.waitingForContinue) {
            this.waitingForContinue = true;
            const nextLabel = this.getNextStepLabel(this.lastResponseFeature, this.currentSectionIndex);
            if (nextLabel) {
                this.renderContinueButton(nextLabel);
                // 当显示继续按钮时，也显示反馈按钮
                this.renderFeedbackUI();
            }
        }
    } else {
        // 还在当前部分，正常渲染
        const currentSectionContent = this.sections[this.currentSectionIndex];
        if (this.currentStreamTarget) {
            this.currentStreamTarget.innerHTML = this.parseMarkdown(currentSectionContent);
            this.addCopyButtons(this.currentStreamTarget);
        }
        
        // 只有当用户原本就在底部时才自动滚动
        if (isNearBottom) {
            this.contentArea.scrollTop = this.contentArea.scrollHeight;
        }
    }
  }

  finalizeResponse() {
    this.isStreaming = false;
    this.lastResponseData = this.fullContent;
    
    // 如果流结束了，但我们还在等待用户点击继续（即还有未显示的内容在缓冲区），
    // 按钮应该已经显示了，不需要做额外操作。
    // 如果流结束了，且没有未显示的内容（即所有内容都显示完了），也不需要操作。
    
    // 渲染反馈按钮 (如果还没有显示的话)
    if (!this.waitingForContinue) {
        this.renderFeedbackUI();
    }
    
    // 保存历史记录到本地存储
    if (this.lastResponseFeature && this.lastResponseData) {
      const pageType = this.getCurrentPageType();
      if (pageType !== 'other') {
        this.saveHistory(pageType, this.lastResponseFeature, this.lastResponseData);
      }
    }
  }

  onContinueClick() {
      this.waitingForContinue = false;
      this.currentSectionIndex++;
      
      // 移除按钮
      const btn = this.contentArea.querySelector('.oj-helper-continue-container');
      if(btn) btn.remove();

      // 移除旧的反馈按钮，避免重复或位置错误
      const existingFeedback = this.contentArea.querySelector('.oj-helper-feedback-root');
      if (existingFeedback) existingFeedback.remove();
      
      // 创建新的内容块
      const responseContainer = this.contentArea.querySelector('.oj-helper-response');
      const newContentDiv = document.createElement('div');
      newContentDiv.className = `oj-helper-markdown-body section-${this.currentSectionIndex}`;
      newContentDiv.style.marginTop = '30px';
      newContentDiv.style.borderTop = '1px dashed #ccc';
      newContentDiv.style.paddingTop = '10px';
      responseContainer.appendChild(newContentDiv);
      
      this.currentStreamTarget = newContentDiv;
      
      // 渲染新部分的内容（可能已经部分或全部在缓冲区里了）
      const currentSectionContent = this.sections[this.currentSectionIndex] || '';
      this.currentStreamTarget.innerHTML = this.parseMarkdown(currentSectionContent);
      this.addCopyButtons(this.currentStreamTarget);
      this.contentArea.scrollTop = this.contentArea.scrollHeight;
      
      // 检查是否还有下一部分（快速点击的情况）
      if (this.sections.length > this.currentSectionIndex + 1) {
           this.waitingForContinue = true;
           const nextLabel = this.getNextStepLabel(this.lastResponseFeature, this.currentSectionIndex);
           if (nextLabel) {
               this.renderContinueButton(nextLabel);
               this.renderFeedbackUI();
           }
      } else if (!this.isStreaming) {
           // 如果流已经结束，且这是最后一部分，显示反馈按钮
           this.renderFeedbackUI();
      }
      
      // 移除之前无条件调用的 renderFeedbackUI
  }

  getNextStepLabel(feature, currentIndex) {
      if (feature === 'guide') {
          if (currentIndex === 0) return '继续引导 (核心概念)';
          if (currentIndex === 1) return '继续引导 (算法流程)';
          if (currentIndex === 2) return '查看参考代码';
      } else if (['hint', 'idea'].includes(feature)) {
          if (currentIndex === 0) return '更详细一些';
      } else if (feature === 'fix') {
          if (currentIndex === 0) return '查看修复方案';
      } else if (feature === 'recommend' || feature === 'knowledge_tag') {
          if (currentIndex === 0) return '查看概念讲解';
          if (currentIndex === 1) return '查看学习路径';
      }
      return null;
  }

  renderContinueButton(label) {
    if (!this.contentArea) return;
    // 防止重复添加
    if (this.contentArea.querySelector('.oj-helper-continue-container')) return;
    
    const btnContainer = document.createElement('div');
    btnContainer.className = 'oj-helper-continue-container';
    
    const btn = document.createElement('button');
    btn.className = 'oj-helper-continue-btn';
    btn.textContent = label;
    
    btn.onclick = () => {
      this.onContinueClick();
    };
    
    btnContainer.appendChild(btn);
    this.contentArea.appendChild(btnContainer);
    this.contentArea.scrollTop = this.contentArea.scrollHeight;
  }

  showLastResponse() {
    // 获取当前页面类型
    const currentPageType = this.getCurrentPageType();
    
    // 1. 首先尝试从本地存储获取当前页面类型的最新历史记录
    const latestHistory = this.getLatestHistoryByPageType(currentPageType);
    
    if (latestHistory) {
      // 从本地存储加载历史记录
      this.initResponse(latestHistory.feature);
      this.fullContent = latestHistory.data;
      this.sections = this.fullContent.split(this.SEPARATOR_REGEX);
      
      // 更新内存中的最后响应数据
      this.lastResponseFeature = latestHistory.feature;
      this.lastResponseData = latestHistory.data;
      
      // 渲染第一部分
      this.currentStreamTarget.innerHTML = this.parseMarkdown(this.sections[0]);
      this.addCopyButtons(this.currentStreamTarget);
      
      // 如果有更多部分，显示按钮
      if (this.sections.length > 1) {
          this.waitingForContinue = true;
          const nextLabel = this.getNextStepLabel(latestHistory.feature, 0);
          if (nextLabel) this.renderContinueButton(nextLabel);
      }
      
      return true;
    }
    
    // 2. 如果本地存储没有，尝试使用内存中的最后响应数据
    if (this.lastResponseFeature && this.lastResponseData) {
      // 恢复显示时，我们只显示第一部分，或者全部显示？
      // 简单起见，全部显示，或者重置状态。
      // 这里选择重置状态，像刚开始一样
      this.initResponse(this.lastResponseFeature);
      this.fullContent = this.lastResponseData;
      this.sections = this.fullContent.split(this.SEPARATOR_REGEX);
      
      // 渲染第一部分
      this.currentStreamTarget.innerHTML = this.parseMarkdown(this.sections[0]);
      this.addCopyButtons(this.currentStreamTarget);
      
      // 如果有更多部分，显示按钮
      if (this.sections.length > 1) {
          this.waitingForContinue = true;
          const nextLabel = this.getNextStepLabel(this.lastResponseFeature, 0);
          if (nextLabel) this.renderContinueButton(nextLabel);
      }
      
      return true;
    }
    
    // 3. 没有找到任何历史记录
    return false;
  }

  showError(message, error = null) {
    this.createSidebar();
    
    // 检查错误信息是否包含prompt（格式：错误信息|||prompt）
    const errorParts = message.split('|||');
    const actualMessage = errorParts[0];
    const prompt = errorParts[1] || null;
    
    let errorHtml = `
      <div class="oj-helper-error">
        <h4>❌ 出错了</h4>
        <p>${actualMessage}</p>
    `;
    
    // 如果有prompt，只添加复制按钮（不显示prompt内容）
    if (prompt) {
      errorHtml += `
        <div class="oj-helper-prompt-container">
          <div class="oj-helper-copy-only-container">
            <button class="oj-helper-copy-btn" data-prompt="${this.escapeHtml(prompt)}">复制提示词</button>
          </div>
        </div>
      `;
    }
    
    errorHtml += `</div>`;
    
    this.contentArea.innerHTML = errorHtml;
    
    // 如果有复制按钮，添加点击事件
    if (prompt) {
      const copyBtn = this.contentArea.querySelector('.oj-helper-copy-btn');
      if (copyBtn) {
        copyBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          try {
            // 尝试使用 Clipboard API
            await navigator.clipboard.writeText(prompt);
            copyBtn.textContent = '已复制';
            copyBtn.classList.add('copied');
            setTimeout(() => {
              copyBtn.textContent = '复制提示词';
              copyBtn.classList.remove('copied');
            }, 2000);
          } catch (error) {
            console.error('[UIManager] Clipboard API failed, trying fallback:', error);
            // 备用方案：使用传统的 copy 方法
            try {
              const textArea = document.createElement('textarea');
              textArea.value = prompt;
              textArea.style.position = 'fixed';
              textArea.style.left = '-999999px';
              textArea.style.top = '-999999px';
              document.body.appendChild(textArea);
              textArea.focus();
              textArea.select();
              document.execCommand('copy');
              document.body.removeChild(textArea);
              
              copyBtn.textContent = '已复制';
              copyBtn.classList.add('copied');
              setTimeout(() => {
                copyBtn.textContent = '复制提示词';
                copyBtn.classList.remove('copied');
              }, 2000);
            } catch (fallbackError) {
              console.error('[UIManager] Copy fallback failed:', fallbackError);
              copyBtn.textContent = '复制失败';
              copyBtn.classList.add('error');
              setTimeout(() => {
                copyBtn.textContent = '复制提示词';
                copyBtn.classList.remove('error');
              }, 2000);
            }
          }
        });
      }
    }
    
    this.isStreaming = false;
  }

  getFeatureTitle(feature) {
    const titles = {
      guide: '📚 问题引导',
      hint: '💡 思路提示',
      idea: '💡 思路提示',
      fix: '🔧 代码纠错',
      recommend: '📖 知识推荐',
      knowledge_tag: '📖 知识推荐',
    };
    return titles[feature] || '📝 AI 回复';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  renderFeedbackUI() {
    // 如果已经存在，先移除旧的（为了重新定位到底部）
    const existing = this.contentArea.querySelector('.oj-helper-feedback-root');
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.className = 'oj-helper-feedback-root';
    
    // 初始按钮
    const triggerBtn = document.createElement('button');
    triggerBtn.className = 'oj-helper-feedback-btn';
    triggerBtn.innerHTML = '<span>👎</span> 我不满意';
    triggerBtn.title = '反馈回答质量';
    
    // 选项容器
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'oj-helper-feedback-options';
    optionsContainer.style.display = 'none';
    
    const reasons = [
        { label: '🤔 提示不到位', value: 'bad_hint' },
        { label: '📜 回答过长', value: 'too_long' },
        { label: '📝 回答过短', value: 'too_short' }
    ];

    // 只有当回答包含代码块时，才显示代码错误选项
    if (this.fullContent && this.fullContent.includes('```')) {
        reasons.unshift({ label: '❌ 代码错误', value: 'code_error' });
    }
    
    reasons.forEach(reason => {
        const btn = document.createElement('button');
        btn.className = 'oj-helper-feedback-option';
        btn.textContent = reason.label;
        btn.onclick = () => {
            this.submitFeedback(reason.value, container);
        };
        optionsContainer.appendChild(btn);
    });
    
    // 交互逻辑
    triggerBtn.onclick = () => {
        if (optionsContainer.style.display === 'none') {
            optionsContainer.style.display = 'flex';
            triggerBtn.style.display = 'none'; // 隐藏触发按钮，展示选项
        }
    };
    
    container.appendChild(triggerBtn);
    container.appendChild(optionsContainer);
    
    // 插入位置：如果有“继续”按钮，插在它后面；否则插在最后
    const continueContainer = this.contentArea.querySelector('.oj-helper-continue-container');
    if (continueContainer) {
        // 稍微调整样式以适应并排或垂直布局
        container.style.marginTop = '8px';
        container.style.borderTop = 'none'; // 紧跟在继续按钮后，不需要分割线
        this.contentArea.appendChild(container);
    } else {
        this.contentArea.appendChild(container);
    }
    
    this.contentArea.scrollTop = this.contentArea.scrollHeight;
  }

  submitFeedback(reason, container) {
      // 发送反馈遥测
      chrome.runtime.sendMessage({
          action: 'send_feedback',
          data: {
              feature: this.lastResponseFeature,
              reason: reason
          }
      });
      
      // 检查是否可以重新生成 (仅限一次)
      if (!this.hasRegenerated && this.lastPayload) {
          this.hasRegenerated = true; // 标记已重新生成
          
          // 更新 UI 显示状态
          container.innerHTML = `
            <div style="color: #2196f3; font-size: 12px; display: flex; align-items: center; gap: 4px; padding: 4px;">
                <span class="oj-helper-loading-spinner">🔄</span> 正在根据反馈优化回答...
            </div>
          `;
          
          // 准备新的 payload
          const newPayload = { ...this.lastPayload };
          newPayload.feedbackReason = reason;
          newPayload.isRegeneration = true;
          
          // 延迟一点点让用户看清提示，然后开始请求
          setTimeout(() => {
              this.sendStreamRequest(newPayload);
          }, 800);
          
      } else {
          // 如果已经重新生成过，或者没有 payload，只显示感谢
          container.innerHTML = `
            <div style="color: #4caf50; font-size: 12px; display: flex; align-items: center; gap: 4px;">
                <span>✓</span> 感谢反馈
            </div>
          `;
          
          // 2秒后淡出
          setTimeout(() => {
              container.style.transition = 'opacity 0.5s';
              container.style.opacity = '0';
              setTimeout(() => container.remove(), 500);
          }, 2000);
      }
  }

  // 发送流式请求的通用方法
  sendStreamRequest(payload) {
    if (this.showLoading) {
        this.showLoading(payload.isRegeneration ? 'AI 正在根据反馈重新思考...' : 'AI 正在思考中...');
    }

    try {
        // 断开之前的活动连接（如果有）
        if (this.activePort) {
            this.activePort.disconnect();
            this.activePort = null;
        }
        
        const context_json = JSON.stringify(payload);
        const port = chrome.runtime.connect({ name: 'ai-stream' });
        this.activePort = port; // 保存当前活动连接
        
        port.postMessage({ 
            action: "invoke_feature_stream", 
            feature: payload.feature, 
            context_json 
        });

        let currentRequestId = null;
        if (this.initResponse) {
            currentRequestId = this.initResponse(payload.feature);
        }

        port.onMessage.addListener((msg) => {
            if (msg.type === 'chunk') {
                if (this.appendStreamContent) {
                    this.appendStreamContent(msg.data, currentRequestId);
                }
            } else if (msg.type === 'done') {
                if (this.finalizeResponse) {
                    this.finalizeResponse();
                }
                port.disconnect();
            } else if (msg.type === 'error') {
                if (this.showError) {
                    this.showError(msg.error || '未知错误');
                }
                port.disconnect();
            }
        });

        port.onDisconnect.addListener(() => {
            if (chrome.runtime.lastError) {
                console.error('Port disconnected due to error:', chrome.runtime.lastError);
                if (this.showError) {
                    this.showError('连接断开: ' + chrome.runtime.lastError.message);
                }
            }
            // 如果断开的是当前活动连接，重置所有相关状态
            if (this.activePort === port) {
                this.activePort = null;
                this.isStreaming = false;
                // 不要重置fullContent等状态，因为可能需要显示历史记录
            }
        });
    } catch (e) {
        console.error('[Content-Script] Connection failed', e);
        if (this.showError) {
            this.showError('无法连接到 AI 服务');
        }
    }
  }

  // 显示个性化推荐输入框
  showRecommendationInput(callback) {
    // 1. 取消可能的关闭操作和定时器
    if (this.closeTimer) {
        clearTimeout(this.closeTimer);
        this.closeTimer = null;
    }
    
    // 2. 断开之前的活动连接（如果有）
    if (this.activePort) {
        this.activePort.disconnect();
        this.activePort = null;
    }
    
    // 3. 重置所有状态
    this.fullContent = '';
    this.sections = [];
    this.currentSectionIndex = 0;
    this.waitingForContinue = false;
    this.isStreaming = false;
    this.lastResponseData = null;
    this.currentRequestId = Date.now();
    this.lastResponseFeature = 'recommend';
    this.currentFeature = 'recommend'; // 更新当前功能类型
    
    // 4. 创建UI
    this.createSidebar();
    this.contentArea.innerHTML = '';
    
    const container = document.createElement('div');
    container.className = 'oj-helper-recommend-input';
    
    container.innerHTML = `
      <div class="oj-helper-recommend-header">
        <h3>🎯 个性化知识推荐</h3>
        <p>告诉我你想学什么，或者你现在的学习阶段。</p>
      </div>
      <div class="oj-helper-recommend-form">
        <textarea 
          id="oj-recommend-query" 
          placeholder="例如：\n- 我想学习图论基础\n- 我是算法竞赛入门选手，下一步该学什么？\n- 帮我讲解一下红黑树"
          rows="4"
        ></textarea>
        <div class="oj-helper-recommend-tags">
          <span class="tag" data-value="我是算法入门新手">入门新手</span>
          <span class="tag" data-value="我想学习动态规划">动态规划</span>
          <span class="tag" data-value="我想学习图论">图论</span>
          <span class="tag" data-value="备战 NOIP/CSP">备战考级</span>
        </div>
        <button id="oj-recommend-submit" class="oj-helper-submit-btn">开始推荐</button>
      </div>
    `;
    
    this.contentArea.appendChild(container);
    
    const textarea = container.querySelector('#oj-recommend-query');
    const submitBtn = container.querySelector('#oj-recommend-submit');
    const tags = container.querySelectorAll('.tag');
    
    // 标签点击填入
    tags.forEach(tag => {
      tag.onclick = () => {
        textarea.value = tag.dataset.value;
        textarea.focus();
      };
    });
    
    // 提交处理
    const handleSubmit = () => {
      const query = textarea.value.trim();
      if (!query) {
        textarea.style.borderColor = 'red';
        setTimeout(() => textarea.style.borderColor = '', 1000);
        return;
      }
      
      // 显示加载状态
      this.showLoading('正在为您定制学习路线...');
      if (callback) callback(query);
    };
    
    submitBtn.onclick = handleSubmit;
    
    // Ctrl+Enter 提交
    textarea.onkeydown = (e) => {
      if (e.ctrlKey && e.key === 'Enter') {
        handleSubmit();
      }
    };
    
    textarea.focus();
  }

  // 重新生成当前功能
  regenerate() {
    // 如果有自定义的重新生成回调，优先使用
    if (this.onReload) {
      this.onReload();
      return;
    }
    
    // 如果没有自定义回调，但有当前功能类型和最后一次的payload，直接重新发送请求
    if (this.currentFeature && this.lastPayload) {
      // 重置状态
      this.initResponse(this.currentFeature);
      // 重新发送请求
      this.sendStreamRequest(this.lastPayload);
    } else if (this.currentFeature) {
      // 如果只有当前功能类型，需要重新获取上下文
      // 这种情况不应该发生，因为 onReload 应该已经被设置
      console.warn('[UIManager] regenerate() - Missing onReload callback or lastPayload');
    }
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
    console.log('[Content-Script] detectPageType() href:', href);
    // 结果页：包含 /solution/ 或 /submission/
    if (/\/solution\//.test(href) || /\/submission\//.test(href)) {
      console.log('[Content-Script] detectPageType() returning "result"');
      return 'result';
    }
    // 提交页：包含 /submit/
    if (/\/submit\/?$/.test(href) || /\/submit\//.test(href)) {
      console.log('[Content-Script] detectPageType() returning "submit"');
      return 'submit';
    }
    // 题目页：通常是数字+字母结尾，或者没有特定后缀，且包含题目内容
    // 排除 submit 和 result 后，如果有题面主体，认为是题目页
    if (document.querySelector('dl.problem-content') || document.querySelector('#pageTitle') || document.querySelector('.problem-statistics')) {
      console.log('[Content-Script] detectPageType() returning "problem"');
      return 'problem';
    }
    console.log('[Content-Script] detectPageType() returning "other"');
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
    
    // 创建显示最近回复的按钮
    const historyBtn = document.createElement('button');
    historyBtn.id = 'oj-helper-history-btn';
    historyBtn.className = 'oj-helper-history-btn';
    historyBtn.title = '查看最近回复';
    historyBtn.setAttribute('aria-label', '查看最近回复');
    historyBtn.innerHTML = ''; // 确保没有残留内容
    
    // 直接设置按钮的背景图片，避免img元素可能的问题
    const normalImgPath = chrome.runtime.getURL('assets/ui/notebook_normal.png');
    const activeImgPath = chrome.runtime.getURL('assets/ui/notebook_onclick.png');
    
    // 设置按钮样式为使用背景图片
    historyBtn.style.backgroundImage = `url('${normalImgPath}')`;
    historyBtn.style.backgroundSize = 'contain';
    historyBtn.style.backgroundRepeat = 'no-repeat';
    historyBtn.style.backgroundPosition = 'center';
    
    // 记录图片路径用于调试
    console.log('历史回复按钮图片路径:', normalImgPath, activeImgPath);
    
    // 添加事件监听器
    historyBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // 防止触发菜单展开
      // 点击时切换到活动图片
      historyBtn.style.backgroundImage = `url('${activeImgPath}')`;
      // 短暂延迟后恢复正常图片
      setTimeout(() => {
        historyBtn.style.backgroundImage = `url('${normalImgPath}')`;
      }, 200);
      
      if (uiManager && uiManager.showLastResponse) {
        const success = uiManager.showLastResponse();
        if (!success) {
          console.log('没有可显示的历史回复');
        }
      }
    });
    
    // 悬停效果
    historyBtn.addEventListener('mouseenter', () => {
      historyBtn.style.backgroundImage = `url('${activeImgPath}')`;
    });
    
    historyBtn.addEventListener('mouseleave', () => {
      historyBtn.style.backgroundImage = `url('${normalImgPath}')`;
    });
    
    main.appendChild(historyBtn);
    
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
      // 如果侧边栏已创建但被收起，点击小猫时重新显示
      // if (uiManager && uiManager.sidebar && !uiManager.sidebar.classList.contains('visible')) {
      //   uiManager.sidebar.classList.add('visible');
      //   return; // 仅显示侧边栏，不切换动画或展开菜单
      // }

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
    console.log('[Content-Script] Detected page type:', pageType);
    
    // 根据页面类型过滤可用的功能
    const availableFeatures = features.filter((f) => {
      if (f.key === 'guide') return pageType === 'problem'; // 问题引导仅能在题目界面触发
      if (f.key === 'hint') return pageType === 'submit';   // 思路提示仅能在提交界面触发 (原 idea 对应 hint)
      if (f.key === 'fix') return pageType === 'result';    // 代码纠错仅能在提交结果界面触发
      if (f.key === 'recommend') return true;               // 知识推荐在任何页面都可用
      return false; 
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
      // 1. 检查是否在结果页（solution/submission页面）
      if (/\/solution\//.test(location.href) || /\/submission\//.test(location.href)) {
        // 尝试从常见的代码展示位置获取
        const submissionCode = document.querySelector('.submission-code pre, .code pre, pre[class*="code"]');
        if (submissionCode) return submissionCode.innerText || submissionCode.textContent || '';
        // 尝试获取所有pre标签，筛选可能包含代码的
        const allPre = document.querySelectorAll('pre');
        for (const pre of allPre) {
          if (pre.textContent && pre.textContent.trim().length > 50) {
            // 检查内容是否更可能是代码（包含常见代码元素）
            if (/\b(?:#include|using namespace|int main|void|class|function|return|for|while|if|else|const|static|public|private)\b/.test(pre.textContent)) {
              return pre.textContent;
            }
          }
        }
      }
      
      // 2. 普通页面的代码获取逻辑
      const ta = document.querySelector('textarea');
      if (ta && ta.value && ta.value.trim().length > 0) return ta.value;
      const cmEl = document.querySelector('.CodeMirror');
      if (cmEl && window.CodeMirror) {
        try { const cm = (cmEl.CodeMirror || window.CodeMirror); if (cm && typeof cm.getValue === 'function') return cm.getValue(); } catch (e) {}
      }
      const aceEl = document.querySelector('.ace_text-input'); if (aceEl && aceEl.value) return aceEl.value;
      const mon = document.querySelector('.monaco-editor textarea'); if (mon && mon.value) return mon.value;
      const codePre = document.querySelector('pre[class*="sh_"] , pre.sh_cpp, pre.code, .code pre');
      if (codePre) return codePre.innerText || codePre.textContent || '';
      return '';
    }

    // 在结果页尝试提取报错信息（编译/运行错误/评测信息）
    function extractErrorInfo() {
      let errorInfo = '';
      
      // 添加调试信息
      console.log('[Content-Script] extractErrorInfo() called');
      
      // 1. 提取提交状态信息
      // 尝试多种选择器以确保找到元素
      const compileStatusSelectors = [
        '.compile-status',
        'p.compile-status',
        '.compile-info .compile-status',
        '#compile-status'
      ];
      
      let compileStatus = null;
      for (const selector of compileStatusSelectors) {
        compileStatus = document.querySelector(selector);
        if (compileStatus) {
          console.log('[Content-Script] compileStatus found with selector "' + selector + '":', compileStatus);
          break;
        }
      }
      
      if (compileStatus) {
        // 输出元素的完整HTML以便调试
        console.log('[Content-Script] compileStatus HTML:', compileStatus.outerHTML);
        
        const statusText = compileStatus.textContent || compileStatus.innerText;
        const statusLink = compileStatus.querySelector('a');
        console.log('[Content-Script] statusLink found:', statusLink);
        
        if (statusLink) {
          const status = statusLink.textContent || statusLink.innerText;
          const statusClass = statusLink.className;
          console.log('[Content-Script] status text:', status);
          console.log('[Content-Script] status class:', statusClass);
          errorInfo += `提交状态: ${status}\n`;
        } else {
          console.log('[Content-Script] status text without link:', statusText);
          errorInfo += `${statusText}\n`;
        }
      } else {
        // 如果没有找到.compile-status元素，尝试查找其他可能包含状态信息的元素
        console.log('[Content-Script] No .compile-status found, trying alternative selectors');
        
        const alternativeSelectors = [
          '.result-wrong',
          '.result-right',
          '.result-accepted',
          '.result-error',
          'a[class^="result-"]'
        ];
        
        for (const selector of alternativeSelectors) {
          const resultElement = document.querySelector(selector);
          if (resultElement) {
            console.log('[Content-Script] Found result element with selector "' + selector + '":', resultElement);
            const status = resultElement.textContent || resultElement.innerText;
            errorInfo += `提交状态: ${status}\n`;
            break;
          }
        }
      }
      
      // 2. 优先抓取页面上专门的编译错误区域（例如编译错误标题后的 pre）
      const cePre = document.querySelector('h3.h3-compile-status + pre, .compile-info pre, pre.compile-error');
      if (cePre && (cePre.innerText || cePre.textContent || '').trim()) {
        errorInfo += `\n详细错误信息:\n${(cePre.innerText || cePre.textContent || '').trim()}`;
      }
      
      // 3. 其次尝试一些常见容器
      if (!errorInfo.includes('详细错误信息:')) {
        const selectors = ['.compile-error', '.judge-result', '.submission-result', '.error', '#judge-result'];
        for (const s of selectors) {
          const el = document.querySelector(s);
          if (el && (el.innerText||el.textContent||'').trim()) {
            errorInfo += `\n详细错误信息:\n${(el.innerText||el.textContent||'').trim()}`;
            break;
          }
        }
      }
      
      // 4. fallback: 找到包含关键字的段
      if (!errorInfo.includes('详细错误信息:')) {
        const allText = (document.body.innerText || '').slice(0, 2000);
        if (/错误|Error|Compile|Runtime|WA|TLE|RTE|Time Limit Exceeded|Wrong Answer|Accepted/i.test(allText)) {
          const m = allText.match(/.{0,500}/);
          errorInfo += `\n详细信息:\n${m ? m[0] : allText}`;
        }
      }
      
      return errorInfo.trim();
    }

    // 点击动作时的处理
    function onActionClick(key, forceReload = false) {
      console.log("AI 助手 action:", key);
      
      loadUIManager().then(async () => {
        // 如果侧边栏已存在且功能类型一致，且不是强制刷新，直接显示而不重新加载
        // 对于 recommend 功能，我们总是希望重新开始（或者至少提供选项），所以排除它
        if (!forceReload && uiManager && uiManager.sidebar && uiManager.lastResponseFeature === key && key !== 'recommend') {
          uiManager.sidebar.classList.add('visible');
          return;
        }
        
        if (uiManager) {
            uiManager.onReload = () => onActionClick(key, true);
        }

        // 如果是推荐功能，先显示输入框
        if (key === 'recommend') {
            uiManager.showRecommendationInput((userQuery) => {
                // 用户提交后，继续执行后续逻辑，并带上 userQuery
                processAction(userQuery);
            });
            setExpanded(false);
            return;
        }

        processAction();

        function processAction(userQuery = null) {
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

            async function loadPromptContent(featureKey) {
              try {
                const fileMap = {
                  'guide': 'guide.txt',
                  'hint': 'idea.txt',
                  'idea': 'idea.txt',
                  'fix': 'code_fix.txt',
                  'recommend': 'knowledge_tag.txt',
                  'knowledge_tag': 'knowledge_tag.txt'
                };
                const filename = fileMap[featureKey];
                if (!filename) return null;
                
                const url = chrome.runtime.getURL(`prompts/${filename}`);
                const response = await fetch(url);
                if (!response.ok) throw new Error(`Failed to load prompt: ${filename}`);
                return await response.text();
              } catch (e) {
                console.error('[Content-Script] Failed to load prompt:', e);
                return null;
              }
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
              console.log('[Content-Script] handleContext() pageType:', pageType);
              const errorInfo = (pageType === 'result') ? extractErrorInfo() : '';
              console.log('[Content-Script] handleContext() errorInfo:', errorInfo);
              const customPrompt = await loadPromptContent(key);

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
                customPrompt: customPrompt,
                _debug_source: usedSource,
                stream: true,
                userQuery: userQuery // 添加用户查询
              };

              // 保存 payload 用于重新生成
              if (uiManager) {
                  uiManager.lastPayload = payload;
                  uiManager.hasRegenerated = false; // 重置重新生成标记
                  uiManager.sendStreamRequest(payload);
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
        }

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

    // 存储工具函数 - 用于缓存题目信息
function cacheProblemData(path, data) {
  try {
    const key = 'oj_problem_' + path;
    const payload = { ts: Date.now(), path: path, data: data };
    sessionStorage.setItem(key, JSON.stringify(payload));
    sessionStorage.setItem('oj_last_problem', key);
    // 同时发送到后台进行缓存
    try { chrome.runtime.sendMessage({ action: 'cache_problem', path: path, data: data }); } catch (e) {}
  } catch (e) {
    console.warn('[Content-Script] 缓存题目数据失败', e);
  }
}

// 获取缓存的题目信息
function getCachedProblemData(path) {
  try {
    const key = 'oj_problem_' + path;
    const raw = sessionStorage.getItem(key);
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj && obj.data) return obj.data;
    }
  } catch (e) {
    console.warn('[Content-Script] 获取缓存题目数据失败', e);
  }
  return null;
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
                  cacheProblemData(refNorm, parsed2);
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
                  cacheProblemData(refNorm, parsed2);
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
          cacheProblemData(norm, parsed);
        } catch (e) {}
        return Object.assign({}, parsed, { url: location.href });
      }

      try {
        const norm = normalizeProblemPath(location.href);
        const cachedData = getCachedProblemData(norm);
        if (cachedData) {
          return Object.assign({}, cachedData, { url: norm });
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
                  cacheProblemData(refNorm, parsed2);
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
                          cacheProblemData(refNorm, parsed2);
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

  // Expose for testing
  if (typeof window !== 'undefined') {
    window._test_createMenu = createMenu;
  }

})();

if (typeof window !== 'undefined') {
  window.UIManager = UIManager;
  window.LearningTracker = LearningTracker;
}

