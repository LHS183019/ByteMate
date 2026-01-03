# 🐾 POJPaw 用户手册 

## 项目介绍

**POJPaw** (by ByteMate Team) 是一个专为 OpenJudge 平台设计的 AI 编程学习助手 Chrome 扩展。它通过集成大语言模型（LLM），为学生提供实时的编程指导、思路提示、代码纠错和知识推荐，同时配备了可视化的学习仪表盘和电子宠物陪伴系统。

## 数据隐私
查看我们的[隐私政策](https://github.com/LHS183019/ByteMate/blob/pojpaw/PRIVACY_POLICY.md)。


## 🚀 安装指南

### 方式一：浏览器扩展商店

1. Edge 商店：[点击前往下载](https://microsoftedge.microsoft.com/addons/detail/pojpaw-ai-openjudge-hel/blghlnhipannnjeddjbkpdjiikeaoica)
2. Chrome 商店：暂未通过审核

### 方式二：加载已解压的扩展程序（推荐开发/测试）

为了防止更新时数据丢失（Chrome 会根据文件夹路径生成 ID），建议采用以下方式安装和更新：

1.  **建立固定文件夹**：在电脑上创建一个固定的文件夹（例如 `D:\Extensions\POJPaw`），**以后不要修改这个文件夹的名字或位置**。
2.  **下载并解压**：下载最新的 [Released ZIP](https://github.com/LHS183019/ByteMate/releases) 包。
3.  **放入文件**：将解压后的所有文件复制到上述固定文件夹中。
    *   **初次安装**：直接复制进去。
    *   **版本更新**：将新版本解压后的内容**全量覆盖**到该固定文件夹中。
4.  **加载扩展**：
    *   打开 Chrome/Edge 扩展管理页面 (`chrome://extensions`)。
    *   开启右上角的“开发者模式”。
    *   点击“加载已解压的扩展程序”，选择这个**固定文件夹**。

> **⚠️ 更新注意事项**：
> 当有新版本时，请**只替换固定文件夹内的文件**，然后在扩展管理页面点击本扩展的 **刷新/重载** 按钮（⟳ 图标）。
> **千万不要**在浏览器中点击“移除”扩展，也不要更改固定文件夹的路径，否则会导致本地存储的做题记录和设置丢失！


## ⚙️ 配置说明

安装完成后，点击浏览器右上角的插件图标（POJPaw 图标）打开设置面板：

1.  **选择模型**：暂时支持 DeepSeek, Qwen (通义千问), OpenAI (GPT-4o), Google Gemini, Anthropic Claude。
2.  **配置 API Key**：
    *   输入您的 API Key。
    *   或者**留空**，你仍然可以拷贝prompt至自己偏好的软件使用。
3.  **保存**：点击保存按钮，即可开始使用。



## 🚀 功能说明


### 实时编程指导

启用 POJPaw 后，在 [OpenJudge](http://openjudge.cn/) 平台上会自动载入伙伴，点击伙伴开始对话，获得陪伴与指导。

### 设置面板

点击浏览器右上角的插件图标，可打开 POJPaw 设置面板，可设置：

+ LLM模型(DeepSeek, Qwen, ChatGPT, Claude, Gemini)

+ 您的 API Key

+ 您偏好的编程语言(C++ / Python)。

在设置面板下方可以找到打开 Dashboard 和 题库 的链接

### 学习仪表盘

Dashboard 页面展示了今日学习情况、做题记录、电子伙伴状态。

您还可以在dashboard下方撰写给予我们的反馈。

### 题库

Problemset中集成了openjudge的所有题目，并对题目进行了分类，方便检索。

---

*Last Updated: 2026-1-3*

&copy; 2025 ByteMate Team.