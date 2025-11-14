window.addEventListener("load", () => {
  const btn = document.createElement("div");
  btn.id = "oj-helper-btn";
  btn.innerText = "AI 助手";
  document.body.appendChild(btn);

  btn.onclick = () => {
    console.log("点击 AI 助手");
  };
});
