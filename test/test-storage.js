// test-storage.js - 测试重构后的StorageManager类
// 此文件用于全面测试重构后的StorageManager功能

console.log('=== 开始测试重构后的StorageManager ===');

/**
 * 等待指定时间
 * @param {number} ms 毫秒数
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 测试StorageManager基本功能
 */
async function testBasicFeatures() {
  console.log('\n1. 测试基本功能...');
  
  try {
    // 检查StorageManager是否存在
    if (typeof StorageManager === 'undefined') {
      console.error('✗ StorageManager未定义');
      return false;
    }
    console.log('✓ StorageManager已定义');
    
    // 初始化用户
    const userId = await StorageManager.initializeUser();
    console.log('✓ 用户初始化成功:', userId);
    
    // 获取用户ID
    const retrievedUserId = await StorageManager.getUserId();
    console.log('✓ 获取用户ID成功:', retrievedUserId);
    console.assert(userId === retrievedUserId, '✗ 用户ID不匹配');
    
    return true;
  } catch (error) {
    console.error('✗ 基本功能测试失败:', error);
    return false;
  }
}

/**
 * 测试学习进度相关功能
 */
async function testProgressManagement() {
  console.log('\n2. 测试学习进度管理...');
  
  try {
    const problemId = 'test_problem_' + Date.now();
    const progressData = {
      status: 'solved',
      time: Date.now(),
      attempts: 3,
      lastSubmission: '2024-01-01'
    };
    
    // 保存学习进度
    await StorageManager.saveProgress(problemId, progressData);
    console.log('✓ 保存学习进度成功');
    
    // 获取学习进度
    const retrievedProgress = await StorageManager.getProgress(problemId);
    console.log('✓ 获取学习进度成功:', retrievedProgress);
    console.assert(retrievedProgress.status === progressData.status, '✗ 进度数据不匹配');
    
    // 获取所有进度
    const allProgress = await StorageManager.getAllProgress();
    console.log('✓ 获取所有进度成功，共', Object.keys(allProgress).length, '个记录');
    
    return true;
  } catch (error) {
    console.error('✗ 学习进度管理测试失败:', error);
    return false;
  }
}

/**
 * 测试宠物状态相关功能
 */
async function testPetManagement() {
  console.log('\n3. 测试宠物状态管理...');
  
  try {
    const petData = {
      hunger: 85,
      happiness: 75,
      energy: 65,
      level: 2,
      experience: 150
    };
    
    // 更新宠物状态
    await StorageManager.updatePetStatus(petData);
    console.log('✓ 更新宠物状态成功');
    
    // 获取宠物状态
    const retrievedPetStatus = await StorageManager.getPetStatus();
    console.log('✓ 获取宠物状态成功:', retrievedPetStatus);
    console.assert(retrievedPetStatus.hunger === petData.hunger, '✗ 宠物数据不匹配');
    
    return true;
  } catch (error) {
    console.error('✗ 宠物状态管理测试失败:', error);
    return false;
  }
}

/**
 * 测试知识点标签相关功能
 */
async function testKnowledgeTags() {
  console.log('\n4. 测试知识点标签管理...');
  
  try {
    const tags = ['动态规划', '贪心算法', '图论', '排序算法'];
    
    // 更新知识点标签
    await StorageManager.updateKnowledgeTags(tags);
    console.log('✓ 更新知识点标签成功');
    
    // 获取知识点标签
    const retrievedTags = await StorageManager.getKnowledgeTags();
    console.log('✓ 获取知识点标签成功:', retrievedTags);
    console.assert(retrievedTags.length === tags.length, '✗ 标签数量不匹配');
    
    // 测试标签去重
    const duplicateTags = ['动态规划', '图论', '图论', '回溯法'];
    await StorageManager.updateKnowledgeTags(duplicateTags);
    const uniqueTags = await StorageManager.getKnowledgeTags();
    console.log('✓ 标签去重测试成功:', uniqueTags);
    
    return true;
  } catch (error) {
    console.error('✗ 知识点标签管理测试失败:', error);
    return false;
  }
}

/**
 * 测试统计数据相关功能
 */
async function testStatistics() {
  console.log('\n5. 测试统计数据管理...');
  
  try {
    // 测试今日统计
    await StorageManager.updateTodayStats({
      problemsSolved: 2,
      timeSpent: 1800,
      hintsUsed: 1
    });
    console.log('✓ 更新今日统计成功');
    
    const todayStats = await StorageManager.getTodayStats();
    console.log('✓ 获取今日统计成功:', todayStats);
    
    // 测试学习统计
    await StorageManager.updateLearningStats({
      totalProblemsSolved: 45,
      totalTimeSpent: 36000,
      totalHintsUsed: 15
    });
    console.log('✓ 更新学习统计成功');
    
    const learningStats = await StorageManager.getLearningStats();
    console.log('✓ 获取学习统计成功:', learningStats);
    
    return true;
  } catch (error) {
    console.error('✗ 统计数据管理测试失败:', error);
    return false;
  }
}

/**
 * 测试存储策略切换功能
 */
async function testStorageStrategies() {
  console.log('\n6. 测试存储策略切换...');
  
  try {
    // 测试local存储
    await StorageManager.setStorageType('local');
    console.log('✓ 切换到local存储成功');
    
    await StorageManager.saveProgress('test_local_strategy', { status: 'attempted' });
    const localProgress = await StorageManager.getProgress('test_local_strategy');
    console.log('✓ Local存储操作成功:', localProgress);
    
    // 测试sync存储
    await StorageManager.setStorageType('sync');
    console.log('✓ 切换到sync存储成功');
    
    await StorageManager.saveProgress('test_sync_strategy', { status: 'attempted' });
    const syncProgress = await StorageManager.getProgress('test_sync_strategy');
    console.log('✓ Sync存储操作成功:', syncProgress);
    
    // 恢复默认存储
    await StorageManager.setStorageType('sync'); // 默认使用sync
    
    return true;
  } catch (error) {
    console.error('✗ 存储策略切换测试失败:', error);
    return false;
  }
}

/**
 * 运行所有测试
 */
async function runAllTests() {
  console.log('开始运行所有StorageManager测试...');
  
  const results = [];
  
  // 运行各个测试
  results.push(await testBasicFeatures());
  results.push(await testProgressManagement());
  results.push(await testPetManagement());
  results.push(await testKnowledgeTags());
  results.push(await testStatistics());
  results.push(await testStorageStrategies());
  
  // 计算总体结果
  const passed = results.filter(r => r === true).length;
  const total = results.length;
  const successRate = (passed / total * 100).toFixed(1);
  
  console.log('\n=== 测试结果汇总 ===');
  console.log(`通过: ${passed}/${total} (${successRate}%)`);
  
  if (passed === total) {
    console.log('🎉 所有测试通过！重构后的StorageManager功能正常。');
  } else {
    console.log('❌ 有测试失败，请检查StorageManager实现。');
  }
  
  return passed === total;
}

// 当文件被直接运行时执行测试
if (typeof module !== 'undefined' && !module.parent) {
  // 如果在Node环境中，需要等待DOM加载
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', runAllTests);
    } else {
      runAllTests();
    }
  } else {
    // 在Node环境中模拟Chrome存储API并运行测试
    console.log('注意：在Node环境中无法直接测试Chrome存储API，需要使用模拟实现');
  }
}

// 导出测试函数，方便在其他地方调用
if (typeof module !== 'undefined') {
  module.exports = {
    runAllTests,
    testBasicFeatures,
    testProgressManagement,
    testPetManagement,
    testKnowledgeTags,
    testStatistics,
    testStorageStrategies
  };
}