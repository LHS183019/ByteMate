console.log("[ResultCheck] Script injected at:", window.location.href);

function checkResult() {
    console.log("[ResultCheck] Checking result...");
    try {
        const statusElement = document.getElementsByClassName("compile-status")[0];
        if (!statusElement) {
            console.log("[ResultCheck] 未找到 compile-status 元素");
            return;
        }
        
        const linkElement = statusElement.getElementsByTagName("a")[0];
        if (!linkElement) {
            console.log("[ResultCheck] 未找到结果链接");
            return;
        }
        
        const result = linkElement.text;
        console.log(`[ResultCheck] result: ${result}`);

        const info = document.getElementsByClassName("compile-info")[0];
        if (!info) {
            console.log("[ResultCheck] 未找到 compile-info 元素");
            return;
        }

        const infoItems = info.getElementsByTagName("dd");
        if (infoItems.length < 2) {
            console.log("[ResultCheck] compile-info 信息不足");
            return;
        }

        const praticeId = infoItems[1].textContent;
        console.log(`[ResultCheck] pratice_id: ${praticeId}`);
        
        const time = infoItems[infoItems.length-1].textContent;
        console.log(`[ResultCheck] time: ${time}`);

        // 创建一个新的 Date 对象
        const currentTime = new Date();
        // 获取当前时间的小时、分钟和秒
        const hours = currentTime.getHours();
        const minutes = currentTime.getMinutes();
        const seconds = currentTime.getSeconds();
        // 格式化时间
        const currentTimeStr = `${hours}:${minutes}:${seconds}`;
        // 打印当前时间
        console.log(`[ResultCheck] currentTime: ${currentTimeStr}`);

        const submitTime = new Date(time);

        const timeDiff = (currentTime - submitTime) / 1000;
        console.log(`[ResultCheck] timeDiff: ${timeDiff}s`)

        // 如果状态是 Waiting 或 Compiling，则稍后重试
        if (result === "Waiting" || result === "Compiling") {
            console.log(`[ResultCheck] 当前状态为 ${result}，1秒后重试...`);
            setTimeout(checkResult, 1000);
            return;
        }

        if(timeDiff <= 200) {
            // 只有当提交时间距现在的时间不超过200s时，才向background发送消息
            console.log("[ResultCheck] 发送 submit-result 消息");
            chrome.runtime.sendMessage({
                action: "submit-result",
                data: {
                    result,
                    praticeId,
                    submitTime
                }
            });
        } else {
            console.log("[ResultCheck] 提交时间过久，不发送消息");
        }
    } catch (e) {
        console.error("[ResultCheck] 执行出错:", e);
        // 出错也重试一下，万一是DOM还没加载完
        setTimeout(checkResult, 1000);
    }
}

// 尝试执行
checkResult();

// 如果页面是动态加载的，可能需要观察 DOM 变化
// 但 OpenJudge 通常是静态页面，所以这里先只执行一次

