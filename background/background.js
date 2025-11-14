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

  sendResponse({ reply: "后台已收到" });
});
