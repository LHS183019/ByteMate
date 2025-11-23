console.log("result-check.js已注入");

const result = document.getElementsByClassName("compile-status")[0].getElementsByTagName("a")[0].text;
console.log(`result: ${result}`);

const info = document.getElementsByClassName("compile-info")[0];
const infoItems = info.getElementsByTagName("dd");
const praticeId = infoItems[1].textContent;
console.log(`pratice_id: ${praticeId}`);
const time = infoItems[infoItems.length-1].textContent;
console.log(`time: ${time}`);

// 创建一个新的 Date 对象
const currentTime = new Date();
// 获取当前时间的小时、分钟和秒
const hours = currentTime.getHours();
const minutes = currentTime.getMinutes();
const seconds = currentTime.getSeconds();
// 格式化时间
const currentTimeStr = `${hours}:${minutes}:${seconds}`;
// 打印当前时间
console.log(`currentTime: ${currentTimeStr}`);

const submitTime = new Date(time);

const timeDiff = (currentTime - submitTime) / 1000;
console.log(`timeDiff: ${timeDiff}s`)

if(timeDiff <= 200 && result !== "Waiting") {
    // 只有当提交时间距现在的时间不超过200s时，才向background发送消息
    chrome.runtime.sendMessage({
        action: "submit-result",
        data: {
            result,
            praticeId,
            submitTime
        }
    })
}
