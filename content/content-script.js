console.log("OJ助手内容脚本已注入！");

(function () {
  if (document.getElementById("oj-helper-root")) return;

  // 先加载 UI 管理器
  let uiManager = null;

  function loadUIManager() {
    return new Promise((resolve) => {
      if (uiManager) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('content/ui.js');
      script.onload = () => {
        // ui.js 加载后，uiManager 会被定义到 window 上
        if (typeof window.uiManager !== 'undefined') {
          uiManager = window.uiManager;
          console.log('[Content-Script] UIManager loaded');
          resolve();
        } else {
          console.error('[Content-Script] UIManager not found after script load');
          resolve(); // 继续执行，使用降级方案
        }
      };
      script.onerror = () => {
        console.error('[Content-Script] Failed to load ui.js');
        resolve(); // 继续执行，使用降级方案
      };
      (document.head || document.documentElement).appendChild(script);
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
    if (uiManager && uiManager.showResponse) {
      uiManager.showResponse(feature, result);
    } else {
      console.log('[Content-Script] Response:', { feature, result });
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
    { key: "recommend", label: "知识推荐" },
    { key: "pet", label: "电子宠物" },
  ];

  function createMenu() {
    const root = document.createElement("div");
    root.id = "oj-helper-root";

    const main = document.createElement("button");
    main.id = "oj-helper-btn";
    main.className = "oj-helper-main";
    main.setAttribute("aria-haspopup", "true");
    main.setAttribute("aria-expanded", "false");
    main.title = "AI 助手";
    main.innerText = "AI";
    main.type = "button";

    const menu = document.createElement("div");
    menu.className = "oj-helper-menu";

    // 创建动作按钮
    const actionButtons = features.map((f) => {
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
    let hoverTimeout = null;

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

    // Hover 行为（桌面）
    main.addEventListener("mouseenter", () => {
      clearTimeout(hoverTimeout);
      setExpanded(true);
    });
    main.addEventListener("mouseleave", () => {
      hoverTimeout = setTimeout(() => setExpanded(false), 300);
    });
    menu.addEventListener("mouseenter", () => {
      clearTimeout(hoverTimeout);
      setExpanded(true);
    });
    menu.addEventListener("mouseleave", () => {
      hoverTimeout = setTimeout(() => setExpanded(false), 300);
    });

    // 点击切换（移动端/触摸）
    let touchToggle = false;
    main.addEventListener("click", (e) => {
      if (isTouchDevice()) {
        touchToggle = true;
        setExpanded(!expanded);
      }
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

    // 简单页面类型检测
    function detectPageType() {
      const href = location.href;
      if (/\/solution\//.test(href) || /\/submission\//.test(href)) return 'result';
      if (/\/submit\/?$/.test(href) || /\/submit\//.test(href) || document.querySelector('form[action*="submit"]') || document.querySelector('textarea') || document.querySelector('.CodeMirror')) return 'edit';
      if (document.querySelector('dl.problem-content') || document.querySelector('#pageTitle') || document.querySelector('.problem-statistics')) return 'problem';
      return 'other';
    }

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
      const pageType = detectPageType();
      
      if (key === 'guide' && pageType !== 'problem') {
        alert('问题引导仅能在题目界面触发');
        return;
      }
      if (key === 'hint' && pageType !== 'edit') {
        alert('思路提示仅能在编辑界面触发');
        return;
      }
      if (key === 'fix' && pageType !== 'result') {
        alert('代码纠错仅能在提交结果界面触发');
        return;
      }

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

      if (isTouchDevice() || touchToggle) setExpanded(false);
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
