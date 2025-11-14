console.log("OJ助手内容脚本已注入！");

(function () {
  if (document.getElementById("oj-helper-root")) return; // 防止重复

  const features = [
    { key: "guide", label: "问题引导" },
    { key: "hint", label: "思路提示" },
    { key: "fix", label: "代码纠错" },
    { key: "recommend", label: "知识推荐" },
    { key: "pet", label: "电子宠物" },
  ];

  function createMenu() {
    // 根容器
    const root = document.createElement("div");
    root.id = "oj-helper-root";

    // 主按钮
    const main = document.createElement("button");
    main.id = "oj-helper-btn";
    main.className = "oj-helper-main";
    main.setAttribute("aria-haspopup", "true");
    main.setAttribute("aria-expanded", "false");
    main.title = "AI 助手";
    main.innerText = "AI";
    main.type = "button";

    // 菜单容器
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
      // 如果是触摸设备，点击切换展开；桌面点击不关闭（除非已展开）
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
          // focus first action
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

    // 点击动作时的处理（占位：发送 runtime 消息）
    function onActionClick(key) {
      console.log("AI 助手 action:", key);
      // 在发送前抓取当前题目信息
      let context = {};
      try {
        context = getProblemContext();
      } catch (e) {
        console.warn("获取题目信息失败：", e);
      }

      // 规范化 context 为字符串字段并生成 JSON 字符串（便于后台统一处理）
      const payload = {
        title: String(context.title || ''),
        statement: String(context.statement || ''),
        samples: JSON.stringify(context.samples || []),
        currentCode: String(context.currentCode || ''),
        tags: JSON.stringify(context.tags || []),
        problemId: String(context.problemId || ''),
        url: String(context.url || ''),
        timeLimit: String(context.timeLimit || context.time || ''),
        memoryLimit: String(context.memoryLimit || context.memory || ''),
      };

      const context_json = JSON.stringify(payload);
      console.log('发送 invoke_feature, feature=', key, ' context_json=', context_json);

      // 发送消息到 background 或其他组件，后续会接入 LLM 调用
      chrome.runtime.sendMessage({ action: "invoke_feature", feature: key, context_json }, (resp) => {
        // 可以在这里基于返回结果做 UI 提示（TODO）
        console.log("background response:", resp);
      });
      // 移动端上点击后收起菜单
      if (isTouchDevice() || touchToggle) setExpanded(false);
    }

    // 从页面解析出题目信息（针对 OpenJudge 风格的解析）
    function getProblemContext() {
      const ctx = {
        title: '',
        statement: '',
        samples: [], // {input, output} 或纯文本数组
        currentCode: '',
        tags: [],
        problemId: '',
        url: location.href,
      };

      // Title: OpenJudge 页面通常在 #pageTitle h2
      const pageTitle = document.querySelector('#pageTitle h2') || document.querySelector('.pageTitle h2') || document.querySelector('h1');
      if (pageTitle && pageTitle.innerText.trim()) ctx.title = pageTitle.innerText.trim();
      if (!ctx.title && document.title) ctx.title = document.title.replace(/\s*-\s*OpenJudge.*$/i, '').trim();

      // 优先使用 dl.problem-content 的 dt/dd 对来解析结构化内容
      const dl = document.querySelector('dl.problem-content');
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
          } else if (/^输入/i.test(key)) {
            ctx.input = text;
          } else if (/^输出/i.test(key)) {
            ctx.output = text;
          } else if (/样例输入|样例输入/i.test(key) || /Sample Input/i.test(key)) {
            // dd 里通常有 <pre>
            const pre = dd.querySelector('pre');
            const val = pre ? (pre.innerText || pre.textContent || '').trim() : text;
            if (val) samplesInputs.push(val);
          } else if (/样例输出|样例输出/i.test(key) || /Sample Output/i.test(key)) {
            const pre = dd.querySelector('pre');
            const val = pre ? (pre.innerText || pre.textContent || '').trim() : text;
            if (val) samplesOutputs.push(val);
          } else if (/样例|示例|Sample/i.test(key)) {
            // 有时样例作为单个 dt/dd 对出现，尝试收集内部 pre
            const pres = Array.from(dd.querySelectorAll('pre')).map(n => (n.innerText||n.textContent||'').trim()).filter(Boolean);
            if (pres.length === 1) samplesInputs.push(pres[0]);
            else if (pres.length >= 2) { samplesInputs.push(pres[0]); samplesOutputs.push(pres[1]); }
          }
        });

        // 合并样例输入/输出为 samples 数组
        const maxN = Math.max(samplesInputs.length, samplesOutputs.length);
        for (let i = 0; i < maxN; i++) {
          const s = { input: samplesInputs[i] || '', output: samplesOutputs[i] || '' };
          if (s.input || s.output) ctx.samples.push(s);
        }
      }

      // 如果没有从 dl 中获取到样例，退回到页面中查找 pre/code
      if (ctx.samples.length === 0) {
        const pres = Array.from(document.querySelectorAll('dl.problem-content pre, pre'))
          .map(n => (n.innerText || n.textContent || '').trim())
          .filter(Boolean);
        // 如果 pres 为偶数，尝试配对为 input/output
        if (pres.length >= 2) {
          for (let i = 0; i < pres.length; i += 2) {
            ctx.samples.push({ input: pres[i], output: pres[i+1] || '' });
          }
        } else if (pres.length === 1) {
          ctx.samples.push({ input: pres[0], output: '' });
        }
      }

      // problemId: 在侧边栏 .problem-statistics 中查找 "全局题号" 或者其他标识
      try {
        const statsDl = document.querySelector('.problem-statistics dl');
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
      } catch (e) { /* ignore */ }

      // tags: #problem-tags 或 .problem-tags
      const tagContainer = document.querySelector('#problem-tags') || document.querySelector('.problem-tags') || document.querySelector('.tags');
      if (tagContainer) {
        const items = Array.from(tagContainer.querySelectorAll('a,span,li')).map(n => (n.innerText||'').trim()).filter(Boolean);
        if (items.length) ctx.tags = items;
      } else {
        const meta = document.querySelector('meta[name="keywords"]');
        if (meta && meta.content) ctx.tags = meta.content.split(',').map(s => s.trim()).filter(Boolean);
      }

      // currentCode: 同先前策略尝试 textarea 和常见编辑器
      const ta = document.querySelector('textarea');
      if (ta && ta.value && ta.value.trim().length > 0) {
        ctx.currentCode = ta.value;
      } else {
        const cmEl = document.querySelector('.CodeMirror');
        if (cmEl && window.CodeMirror) {
          try { const cm = cmEl.CodeMirror || window.CodeMirror; if (cm && typeof cm.getValue === 'function') ctx.currentCode = cm.getValue(); } catch (e) {}
        }
        if (!ctx.currentCode) {
          const aceEl = document.querySelector('.ace_text-input'); if (aceEl && aceEl.value) ctx.currentCode = aceEl.value;
        }
        if (!ctx.currentCode) {
          const mon = document.querySelector('.monaco-editor textarea'); if (mon && mon.value) ctx.currentCode = mon.value;
        }
      }

      return ctx;
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
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    createMenu();
  } else {
    window.addEventListener("load", createMenu);
  }

})();
