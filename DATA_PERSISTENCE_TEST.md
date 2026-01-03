# 数据持久性与版本更新测试指南

本通过测试指南旨在验证插件在不同更新方式下，用户数据（如宠物状态、做题进度、API Key 配置）是否能够正确保留。

## 核心原理

Chrome/Edge 扩展的数据存储（`chrome.storage.local` 和 `sync`）是与 **Extension ID** 绑定的。
- **ID 不变** = 数据保留。
- **ID 改变** = 数据丢失（被视为全新安装）。

## 🛠️ 测试辅助工具

在进行测试前，请使用以下代码快速生成和验证测试数据。

### 1. 打开背景页控制台
1. 在浏览器扩展管理页面 (`chrome://extensions` 或 `edge://extensions`)。
2. 开启 **开发者模式**。
3. 找到本插件，点击 **"背景页" (service worker)** 链接打开 DevTools。
4. 切换到 **Console** 面板。

### 2. 写入测试数据脚本
复制并运行以下代码，写入一组特征数据：

```javascript
// 写入测试数据
(async () => {
  const testData = {
    // 1. 宠物数据 (10级，心情50)
    'oj_pet_data': {
      name: '测试专用猫',
      level: 10,
      exp: 50,
      mood: 50,
      hunger: 50,
      lastFeedTime: Date.now(),
      createdAt: Date.now()
    },
    // 2. 学习统计
    'oj_learning_stats': {
      totalProblems: 999,
      totalDuration: 8888,
      successRate: 0.95
    },
    // 3. API Key
    'bytemate_api_key': 'sk-test-persistence-key-123456'
  };
  
  await chrome.storage.local.set(testData);
  console.log('✅ 测试数据写入完成！请记住：等级=10，题目=999');
})();
```

### 3. 验证数据脚本
更新插件后，运行此代码检查数据是否丢失：

```javascript
// 验证测试数据
(async () => {
  const local = await chrome.storage.local.get(null);
  
  const checks = [
    { name: '宠物等级', actual: local.oj_pet_data?.level, expected: 10 },
    { name: '宠物名字', actual: local.oj_pet_data?.name, expected: '测试专用猫' },
    { name: '做题总数', actual: local.oj_learning_stats?.totalProblems, expected: 999 },
    { name: 'API Key', actual: local.bytemate_api_key, expected: 'sk-test-persistence-key-123456' }
  ];
  
  console.table(checks);
  
  const allPassed = checks.every(c => c.actual === c.expected);
  if (allPassed) {
    console.log('%c 🎉 测试通过：所有数据均已保留！', 'color: green; font-size: 16px; font-weight: bold;');
  } else {
    console.log('%c ❌ 测试失败：部分数据丢失或不匹配！', 'color: red; font-size: 16px; font-weight: bold;');
    console.log('可能原因：Extension ID 发生了变化。');
  }
})();
```

---

## 🧪 测试场景 A：ZIP 包手动更新 (开发者模式)

这是用户通过下载 `.zip` 文件并“加载已解压的扩展程序”进行安装的场景。

### ✅ 正确更新流程 (覆盖文件)
**预期结果**：数据保留。

1. **准备**：
   - 创建文件夹 `bytemate_test`。
   - 将插件 v1.0.0 解压到该文件夹。
   - 在浏览器加载该文件夹。
   - **记录 ID** (例如: `abcdefg...`)。
   - 运行 **[写入测试数据脚本]**。
2. **更新**：
   - 下载插件 v1.0.1 (或修改 manifest.json 版本号)。
   - **清空** `bytemate_test` 文件夹的内容（不要删除文件夹本身）。
   - 将 v1.0.1 解压到 **同一个** `bytemate_test` 文件夹。
   - 在浏览器扩展管理页，点击该插件卡片上的 **"刷新" (重载)** 按钮。
3. **验证**：
   - 检查 ID 是否仍为 `abcdefg...`。
   - 打开背景页控制台，运行 **[验证数据脚本]**。

### ❌ 错误更新流程 (新文件夹)
**预期结果**：数据丢失 (ID 变更)。

1. **准备**：同上，安装在 `bytemate_v1` 文件夹。写入数据。
2. **更新**：
   - 将 v1.0.1 解压到新的文件夹 `bytemate_v2`。
   - 在浏览器加载 `bytemate_v2`。
   - (此时浏览器里可能有两个插件，或者你移除了旧的)。
3. **验证**：
   - 你会发现新插件的 ID 变了。
   - 运行验证脚本，数据为空。

---

## 🧪 测试场景 B：模拟商店更新 (CRX 打包)

此方法最接近 Edge/Chrome 商店的真实更新机制。需要使用 Chrome 的打包功能。

### 前置条件
你需要 Chrome 浏览器 (Edge 也可以，但在 `edge://extensions` 开启开发者模式后会有 "打包扩展" 按钮)。

### 测试步骤
1. **打包 v1.0.0**：
   - 点击 "打包扩展程序"。
   - 选择插件根目录。
   - **首次打包**：留空 "私钥文件"。
   - 点击 "打包"。
   - 生成了 `bytemate.crx` 和 `bytemate.pem` (私钥，**非常重要**)。
2. **安装 v1.0.0**：
   - 将 `bytemate.crx` 拖入扩展管理页面安装。
   - 运行 **[写入测试数据脚本]**。
   - 记录 Extension ID。
3. **打包 v2.0.0**：
   - 修改 `manifest.json` 中的 `version` 为 `2.0.0`。
   - 点击 "打包扩展程序"。
   - 选择插件根目录。
   - **私钥文件**：**必须选择第1步生成的 `bytemate.pem`**。
   - 点击 "打包"。生成新的 `bytemate.crx`。
4. **更新**：
   - 将新的 `bytemate.crx` 拖入扩展管理页面。
   - 浏览器应提示 "要更新扩展程序吗？" -> 确认。
5. **验证**：
   - 检查 ID 是否未变。
   - 运行 **[验证数据脚本]**。

---

## 🧪 测试场景 C：Edge 商店实际更新

如果插件已上架，可以使用“灰度发布”或“测试账号”验证。

1. **安装线上版本**：从 Edge 商店安装当前版本。
2. **写入数据**：使用控制台写入测试数据，或手动操作（喂猫、设置Key）。
3. **发布更新**：提交新版本到 Edge 商店并通过审核。
4. **等待更新**：
   - 可以在扩展页点击 "更新" 强制检查。
5. **验证**：
   - 更新完成后，检查数据是否还在。

## ⚠️ 关键结论

1. **对于 ZIP 用户**：必须强调 **"解压覆盖原文件夹，不要删除重装"**。如果用户删除了旧扩展再添加新扩展，ID 会变，数据必丢。
2. **对于 商店 用户**：只要你保管好发布证书（商店自动管理），更新是安全的，数据会自动迁移。
