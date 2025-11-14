const btn = document.getElementById("goto-dashboard");
if (btn) {
  btn.addEventListener("click", () => {
    // 打开扩展内的 dashboard 页面
    const url = chrome.runtime.getURL("dashboard/index.html");
    chrome.tabs.create({ url });
  });
} else {
  console.warn("goto-dashboard button not found in popup");
}
