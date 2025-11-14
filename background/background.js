chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("后台收到消息：", msg);
  // 处理打开 url 请求
  if (msg && msg.action === "open_url" && msg.url) {
    try {
      chrome.tabs.create({ url: msg.url }, () => {
        // 回调后发送响应
        sendResponse({ ok: true });
      });
      // 返回 true 表示 sendResponse 会在异步回调中被调用
      return true;
    } catch (e) {
      console.error("打开标签页失败：", e);
      sendResponse({ ok: false, error: String(e) });
      return false;
    }
  }

  // 其它消息默认回复
  if (msg && msg.action === "invoke_feature") {
    console.log("invoke_feature 请求：", msg.feature);
    if (msg.context_json) {
      try {
        const parsed = JSON.parse(msg.context_json);
        console.log("收到题目信息 JSON:", parsed);
      } catch (e) {
        console.warn("无法解析 context_json:", e, msg.context_json);
      }
    } else if (msg.context) {
      console.log("收到题目信息对象:", msg.context);
    }
    // 占位：后续会根据 feature 执行相关逻辑（调用 LLM、打开面板等）
    sendResponse({ ok: true, feature: msg.feature });
    return false;
  }

  // 缓存题目信息请求：存到 chrome.storage.local，便于跨页面读取
  if (msg && msg.action === 'cache_problem') {
    try {
      const key = msg.path ? ('oj_problem_' + msg.path) : ('oj_problem_last');
      const payload = { ts: Date.now(), path: msg.path || '', data: msg.data || {} };
      const obj = {};
      obj[key] = payload;
      // 同时维护一个统一的 last key
      obj['oj_last_problem'] = key;
      chrome.storage.local.set(obj, () => {
        console.log('已缓存题目信息到 storage:', key);
        sendResponse({ ok: true });
      });
      return true;
    } catch (e) {
      console.error('缓存题目信息失败', e);
      sendResponse({ ok: false, error: String(e) });
      return false;
    }
  }

  // 获取缓存题目（按 path 或者最近一个）
  if (msg && msg.action === 'get_cached_problem') {
    try {
      // 如果传入 path，则优先按 path 查找
      const pathKey = msg.path ? ('oj_problem_' + msg.path) : null;
      const look = (items) => {
        if (pathKey && items[pathKey]) return items[pathKey];
        if (items['oj_last_problem']) {
          const lastKey = items['oj_last_problem'];
          if (items[lastKey]) return items[lastKey];
        }
        return null;
      };
      chrome.storage.local.get(null, (items) => {
        const found = look(items);
        if (found) sendResponse({ ok: true, data: found.data, path: found.path });
        else sendResponse({ ok: false });
      });
      return true;
    } catch (e) {
      console.error('读取缓存题目失败', e);
      sendResponse({ ok: false, error: String(e) });
      return false;
    }
  }

  sendResponse({ reply: "后台已收到" });
});
