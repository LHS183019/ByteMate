/**
 * 测试脚本 - 在 DevTools Console 中运行
 */

// 1. 测试后端健康状态
async function testHealth() {
  console.log('=== 测试后端健康状态 ===');
  try {
    const response = await fetch('http://localhost:3000/api/health');
    const data = await response.json();
    console.log('✓ 健康检查响应:', data);
    return data.hasValidConfig;
  } catch (error) {
    console.error('✗ 健康检查失败:', error);
    return false;
  }
}

// 2. 测试 LLM 客户端初始化
function testLLMClient() {
  console.log('=== 测试 LLM 客户端 ===');
  if (typeof llmClient !== 'undefined') {
    console.log('✓ llmClient 已加载');
    console.log('  - 后端 URL:', llmClient.backendUrl);
    console.log('  - 超时时间:', llmClient.timeout);
    return true;
  } else {
    console.error('✗ llmClient 未定义');
    return false;
  }
}

// 3. 测试存储管理器
async function testStorage() {
  console.log('=== 测试存储管理器 ===');
  try {
    if (typeof storageManager !== 'undefined') {
      const userId = await storageManager.initializeUser();
      console.log('✓ 用户 ID:', userId);
      return true;
    } else {
      console.error('✗ storageManager 未定义');
      return false;
    }
  } catch (error) {
    console.error('✗ 存储管理器错误:', error);
    return false;
  }
}

// 4. 测试提示词管理器
async function testPrompts() {
  console.log('=== 测试提示词管理器 ===');
  try {
    if (typeof promptManager !== 'undefined') {
      const initialized = await promptManager.initialize();
      console.log('✓ 提示词初始化:', initialized);
      const guidePrompt = promptManager.getPrompt('guide');
      console.log('✓ Guide 提示词长度:', guidePrompt.length);
      return true;
    } else {
      console.error('✗ promptManager 未定义');
      return false;
    }
  } catch (error) {
    console.error('✗ 提示词管理器错误:', error);
    return false;
  }
}

// 5. 测试 AI 助手初始化
async function testAIAssistant() {
  console.log('=== 测试 AI 助手 ===');
  try {
    if (typeof aiAssistant !== 'undefined') {
      const initialized = await aiAssistant.initialize();
      console.log('✓ AI 助手初始化:', initialized);
      return true;
    } else {
      console.error('✗ aiAssistant 未定义');
      return false;
    }
  } catch (error) {
    console.error('✗ AI 助手错误:', error);
    return false;
  }
}

// 6. 测试完整的 API 调用
async function testFullFlow() {
  console.log('=== 测试完整 API 流程 ===');
  try {
    const problemInfo = {
      feature: 'guide',
      title: '测试题目',
      statement: '这是一个测试问题',
      currentCode: 'console.log("test");',
      samples: [{ input: 'test', output: '' }],
      problemId: 'test-001',
    };

    console.log('发送请求...');
    const result = await aiAssistant.processProblemInfo(problemInfo);
    console.log('✓ 收到响应:', result);
    return true;
  } catch (error) {
    console.error('✗ 完整流程失败:', error);
    return false;
  }
}

// 7. 运行所有测试
async function runAllTests() {
  console.clear();
  console.log('╔════════════════════════════════════════╗');
  console.log('║     AI 编程助手 - 完整测试套件        ║');
  console.log('╚════════════════════════════════════════╝\n');

  const results = {
    后端健康检查: await testHealth(),
    LLM客户端: testLLMClient(),
    存储管理器: await testStorage(),
    提示词管理器: await testPrompts(),
    AI助手: await testAIAssistant(),
  };

  console.log('\n=== 测试总结 ===');
  for (const [name, passed] of Object.entries(results)) {
    console.log(`${passed ? '✓' : '✗'} ${name}`);
  }

  const allPassed = Object.values(results).every(v => v);
  console.log(`\n${allPassed ? '✓ 所有基础测试通过！' : '✗ 部分测试失败'}`);

  if (allPassed) {
    console.log('\n准备运行完整流程测试...');
    await testFullFlow();
  }
}

// 导出以便在控制台使用
window.testSuite = {
  testHealth,
  testLLMClient,
  testStorage,
  testPrompts,
  testAIAssistant,
  testFullFlow,
  runAllTests,
};

console.log('✓ 测试套件已加载');
console.log('运行: testSuite.runAllTests()');
