# AI辅助编程智能浏览器插件

## 快速开始

### 1. 后端服务配置

#### 第一步：配置 API 密钥

在 `backend/.env` 文件中填入你的 AI 模型 API 信息：

```bash
# 在这里输入你的 API URL 和密钥
DEEPSEEK_API_URL=https://api.deepseek.com/v1
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxx

ZHIPU_API_URL=https://api.zhipuai.cn/v1
ZHIPU_API_KEY=your-zhipu-key

QWEN_API_URL=https://dashscope.aliyuncs.com/api/v1
QWEN_API_KEY=your-qwen-key

# 选择默认使用的模型
DEFAULT_MODEL=deepseek
```

**API 密钥申请地址：**
- **DeepSeek**: https://platform.deepseek.com/
- **Zhipu (智谱)**: https://open.bigmodel.cn/
- **Qwen (通义千问)**: https://dashscope.aliyun.com/

#### 第二步：启动后端服务

```bash
cd backend
npm install
node llm-proxy.js
```

你会看到：
```
LLM Proxy running on port 3000
Configured models: [ 'deepseek' ]
```

### 2. 浏览器扩展安装

#### 第一步：在 Chrome 中加载扩展

1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 启用"开发者模式"（右上角）
4. 点击"加载未打包的扩展程序"
5. 选择本项目文件夹

#### 第二步：访问 OpenJudge

1. 访问 https://openjudge.cn/
2. 进入任意编程题目
3. 点击四个辅助按钮之一：
   - **问题引导** - 通过提问引导独立思考
   - **思路提示** - 提供多种解决方案对比
   - **代码纠错** - 检查代码并提供修复建议
   - **知识点识别** - 识别知识点并规划学习路径

---

## 配置说明

### API 密钥位置

**重要：API 密钥只需在以下位置配置，绝不会暴露给用户或上传到 GitHub：**

```
backend/.env  ← 仅在这里配置 API 密钥
```

### .gitignore 配置

`.env` 文件已被添加到 `.gitignore`，确保密钥不会上传到 GitHub：

```
backend/.env
node_modules/
```

### 模型配置

支持同时配置多个模型，在 `backend/.env` 中：

```bash
# 配置所有想要使用的模型
DEEPSEEK_API_KEY=xxx
ZHIPU_API_KEY=xxx
QWEN_API_KEY=xxx

# 选择默认使用的模型
DEFAULT_MODEL=deepseek
```

在浏览器扩展中，用户可以随时切换模型。

---

## 工作流程

```
用户点击辅助按钮
    ↓
浏览器扩展 (Chrome)
    ↓
后端服务 (localhost:3000)
    ↓
AI 模型 API (DeepSeek/Zhipu/Qwen)
    ↓
返回 JSON 格式结果给用户
```

**关键点：API 密钥永远只在后端服务器上，永不暴露给前端或用户。**

---

## 故障排除

### 问题 1：无法连接后端服务

**检查清单：**
- 后端服务是否启动？运行 `node llm-proxy.js`
- 后端服务是否运行在 3000 端口？
- 防火墙是否阻止了 localhost:3000？

### 问题 2：模型请求失败

```
错误：模型 xxx 未配置 API 密钥
```

**解决方案：**
1. 检查 `backend/.env` 文件中是否配置了 API 密钥
2. 确保 API 密钥格式正确
3. 检查 API 密钥是否有效（未过期）

### 问题 3：请求过于频繁

```
错误：请求过于频繁，请稍后再试
```

**解决方案：**
- 系统限制每个用户每小时 100 次请求
- 在 `backend/.env` 中修改 `RATE_LIMIT_PER_HOUR` 值

---

## 开发与部署

### 本地开发

```bash
# 后端
cd backend
npm install
node llm-proxy.js

# 前端
在 Chrome 中加载未打包的扩展程序
```

### 生产部署

对于生产环境，建议：
1. 部署后端服务到服务器（AWS/Heroku/阿里云等）
2. 修改前端 `api/llm.js` 中的 `LLM_BACKEND_URL` 为生产服务器地址
3. 在服务器上配置 `.env` 文件
4. 启用 HTTPS 和请求验证

---

## 安全性说明

✅ **API 密钥安全措施：**
- API 密钥仅存储在后端 `.env` 文件
- 前端永不接触 API 密钥
- 用户本地使用不会暴露密钥
- GitHub 上不会包含 `.env` 文件

✅ **请求安全：**
- 所有 API 调用通过后端代理
- 支持按用户限流防止滥用
- 自动 CORS 验证

---

## FAQ

**Q: 为什么需要启动后端服务？**
A: 后端服务保护你的 API 密钥，防止在前端代码中暴露。这是最佳安全实践。

**Q: 可以在浏览器扩展中配置 API 密钥吗？**
A: 不可以。直接在扩展中配置密钥会导致密钥暴露。必须通过后端服务。

**Q: 支持哪些 AI 模型？**
A: 当前支持 DeepSeek、Zhipu、Qwen。易于扩展其他模型。

**Q: API 密钥会上传到 GitHub 吗？**
A: 不会。`.env` 文件已在 `.gitignore` 中，不会被提交。

---

## 许可证

MIT

