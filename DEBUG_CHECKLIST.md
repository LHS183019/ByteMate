## API 调用调试清单

### 后端检查
- [ ] .env 文件已创建
- [ ] DEEPSEEK_API_KEY 已填入有效的密钥
- [ ] npm install 已完成
- [ ] npm start 后能看到"✓ API configured: YES"
- [ ] curl http://localhost:3000/api/test 返回成功
- [ ] curl -X POST http://localhost:3000/api/test-llm 返回 AI 响应

### 前端检查
- [ ] manifest.json 中的 web_accessible_resources 已配置
- [ ] 在 DevTools Console 中能看到 '[LLMClient] Initialized with backend URL'
- [ ] 能调用 testSuite.testHealth()
- [ ] 能调用 testSuite.runAllTests()

### 网络检查
- [ ] 后端正在 localhost:3000 上运行
- [ ] 防火墙未阻止 3000 端口
- [ ] DevTools Network 标签中能看到对 /api/* 的请求

### 常见问题
1. "LLMClient 未定义" → llm.js 未加载，检查 manifest.json
2. "Cannot fetch /api/assist" → 后端未启动或端口错误
3. "API Key 缺失" → .env 文件未配置或路径错误
4. "CORS 错误" → 后端 cors 配置问题
