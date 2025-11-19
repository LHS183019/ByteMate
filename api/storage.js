/**
 * 存储管理模块
 * 负责学习进度、宠物数据、题目缓存等数据的持久化存储
 */

const Storage = {
  // ==================== 存储键常量 ====================
  KEYS: {
    // 学习进度数据
    LEARNING_STATS: 'oj_learning_stats',          // 学习统计数据
    DAILY_STATS: 'oj_daily_stats',                // 每日统计
    PROBLEMS_SOLVED: 'oj_problems_solved',        // 已解决的题目列表
    PROBLEM_DETAILS: 'oj_problem_details_',       // 单个题目详情（带ID）
    
    // 宠物数据
    PET_DATA: 'oj_pet_data',                      // 宠物状态数据
    PET_STATS: 'oj_pet_stats',                    // 宠物成长统计
    
    // 知识点标签
    KNOWLEDGE_TAGS: 'oj_knowledge_tags',          // 知识点掌握情况
    TAG_PROGRESS: 'oj_tag_progress_',             // 单个标签进度（带标签名）
    
    // 用户设置
    USER_SETTINGS: 'oj_user_settings',            // 用户偏好设置
    LAST_UPDATE: 'oj_last_update',                // 最后更新时间
  },

  // ==================== 初始化函数 ====================
  /**
   * 初始化存储，检查并创建必要的数据结构
   */
  async init() {
    try {
      const existing = await this.getAll();
      
      // 初始化学习统计
      if (!existing[this.KEYS.LEARNING_STATS]) {
        await this.set(this.KEYS.LEARNING_STATS, {
          totalProblems: 0,
          totalDuration: 0,        // 秒
          successRate: 0,
          knowledgeCount: 0,
          createdAt: Date.now(),
        });
      }

      // 初始化宠物数据
      if (!existing[this.KEYS.PET_DATA]) {
        await this.set(this.KEYS.PET_DATA, {
          name: '学习伙伴',
          level: 1,
          exp: 0,
          mood: 100,               // 0-100，心情值
          hunger: 50,              // 0-100，饥饿度
          lastFeedTime: Date.now(),
          createdAt: Date.now(),
        });
      }

      // 初始化知识点标签
      if (!existing[this.KEYS.KNOWLEDGE_TAGS]) {
        await this.set(this.KEYS.KNOWLEDGE_TAGS, {});
      }

      console.log('✓ 存储初始化完成');
      return true;
    } catch (e) {
      console.error('存储初始化失败:', e);
      return false;
    }
  },

  // ==================== 基础存储操作 ====================
  /**
   * 设置值
   */
  async set(key, value) {
    return new Promise((resolve, reject) => {
      try {
        const obj = {};
        obj[key] = value;
        chrome.storage.local.set(obj, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(true);
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  },

  /**
   * 获取值
   */
  async get(key) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get([key], (items) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(items[key] || null);
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  },

  /**
   * 获取所有数据
   */
  async getAll() {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get(null, (items) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(items || {});
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  },

  /**
   * 删除值
   */
  async remove(key) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.remove(key, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(true);
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  },

  /**
   * 清空所有存储
   */
  async clear() {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.clear(() => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(true);
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  },

  // ==================== 学习进度管理 ====================
  /**
   * 获取学习统计
   */
  async getLearningStats() {
    const stats = await this.get(this.KEYS.LEARNING_STATS);
    return stats || {
      totalProblems: 0,
      totalDuration: 0,
      successRate: 0,
      knowledgeCount: 0,
      createdAt: Date.now(),
    };
  },

  /**
   * 更新学习统计
   */
  async updateLearningStats(updates) {
    const current = await this.getLearningStats();
    const updated = { ...current, ...updates };
    await this.set(this.KEYS.LEARNING_STATS, updated);
    return updated;
  },

  /**
   * 记录学习时长
   */
  async recordDuration(seconds) {
    const stats = await this.getLearningStats();
    stats.totalDuration += seconds;
    await this.set(this.KEYS.LEARNING_STATS, stats);
    
    // 更新今日统计
    await this.addTodayDuration(seconds);
    return stats;
  },

  /**
   * 记录题目完成
   */
  async recordProblemSolved(problemId, problemData) {
    const stats = await this.getLearningStats();
    stats.totalProblems += 1;
    await this.set(this.KEYS.LEARNING_STATS, stats);

    // 保存题目详情
    const key = this.KEYS.PROBLEM_DETAILS + problemId;
    await this.set(key, {
      id: problemId,
      ...problemData,
      solvedAt: Date.now(),
    });

    // 更新已解决题目列表
    const solved = await this.get(this.KEYS.PROBLEMS_SOLVED) || [];
    if (!solved.includes(problemId)) {
      solved.push(problemId);
      await this.set(this.KEYS.PROBLEMS_SOLVED, solved);
    }

    // 更新今日完成数
    await this.addTodayCompletedProblem();

    return stats;
  },

  /**
   * 获取已解决的题目列表
   */
  async getProblemsSolved() {
    const solved = await this.get(this.KEYS.PROBLEMS_SOLVED);
    return solved || [];
  },

  /**
   * 获取单个题目详情
   */
  async getProblemDetail(problemId) {
    const key = this.KEYS.PROBLEM_DETAILS + problemId;
    return await this.get(key);
  },

  // ==================== 每日统计管理 ====================
  /**
   * 获取今日统计
   */
  async getTodayStats() {
    const today = this.getTodayKey();
    const stats = await this.get(today);
    if (!stats) {
      return {
        date: today,
        completedCount: 0,
        duration: 0,              // 秒
        tagsLearned: [],
        startTime: Date.now(),
      };
    }
    return stats;
  },

  /**
   * 增加今日完成数
   */
  async addTodayCompletedProblem() {
    const today = this.getTodayKey();
    const stats = await this.getTodayStats();
    stats.completedCount += 1;
    await this.set(today, stats);
    return stats;
  },

  /**
   * 增加今日学习时长
   */
  async addTodayDuration(seconds) {
    const today = this.getTodayKey();
    const stats = await this.getTodayStats();
    stats.duration += seconds;
    await this.set(today, stats);
    return stats;
  },

  /**
   * 添加今日学习的知识点
   */
  async addTodayTag(tag) {
    const today = this.getTodayKey();
    const stats = await this.getTodayStats();
    if (!stats.tagsLearned) stats.tagsLearned = [];
    if (!stats.tagsLearned.includes(tag)) {
      stats.tagsLearned.push(tag);
    }
    await this.set(today, stats);
    return stats;
  },

  /**
   * 获取最近 N 天的统计（用于趋势图表）
   */
  async getRecentDaysStats(days = 7) {
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = this.getDayKey(date);
      const stats = await this.get(key);
      result.push({
        date: key,
        completedCount: stats?.completedCount || 0,
        duration: stats?.duration || 0,
      });
    }
    return result;
  },

  // ==================== 知识点管理 ====================
  /**
   * 获取所有知识点
   */
  async getAllTags() {
    const tags = await this.get(this.KEYS.KNOWLEDGE_TAGS);
    return tags || {};
  },

  /**
   * 更新知识点进度
   */
  async updateTagProgress(tag, progress) {
    const tags = await this.getAllTags();
    tags[tag] = {
      ...tags[tag],
      name: tag,
      progress: Math.min(100, Math.max(0, progress)),
      lastUpdated: Date.now(),
    };
    await this.set(this.KEYS.KNOWLEDGE_TAGS, tags);
    return tags;
  },

  /**
   * 记录标签掌握
   */
  async recordTagMastery(tag, problemCount = 1) {
    const tags = await this.getAllTags();
    if (!tags[tag]) {
      tags[tag] = {
        name: tag,
        count: 0,
        progress: 0,
        createdAt: Date.now(),
      };
    }
    tags[tag].count = (tags[tag].count || 0) + problemCount;
    // 简单计算进度：每做 5 题增加 20%
    tags[tag].progress = Math.min(100, tags[tag].count * 20);
    tags[tag].lastUpdated = Date.now();
    await this.set(this.KEYS.KNOWLEDGE_TAGS, tags);
    return tags;
  },

  /**
   * 获取知识点统计（用于饼图）
   */
  async getTagsStatistics() {
    const tags = await this.getAllTags();
    return Object.values(tags).map(tag => ({
      name: tag.name,
      value: tag.progress || 0,
      count: tag.count || 0,
    }));
  },

  // ==================== 宠物管理 ====================
  /**
   * 获取宠物数据
   */
  async getPetData() {
    const pet = await this.get(this.KEYS.PET_DATA);
    return pet || {
      name: '学习伙伴',
      level: 1,
      exp: 0,
      mood: 100,
      hunger: 50,
      lastFeedTime: Date.now(),
      createdAt: Date.now(),
    };
  },

  /**
   * 更新宠物数据
   */
  async updatePetData(updates) {
    const pet = await this.getPetData();
    const updated = { ...pet, ...updates };
    await this.set(this.KEYS.PET_DATA, updated);
    return updated;
  },

  /**
   * 增加宠物经验值（完成题目时调用）
   */
  async addPetExp(exp) {
    const pet = await this.getPetData();
    pet.exp += exp;
    
    // 经验到达升级阈值
    const expPerLevel = 100;
    if (pet.exp >= expPerLevel) {
      pet.level += Math.floor(pet.exp / expPerLevel);
      pet.exp %= expPerLevel;
    }

    // 完成题目时提升心情
    pet.mood = Math.min(100, pet.mood + 10);
    
    await this.set(this.KEYS.PET_DATA, pet);
    return pet;
  },

  /**
   * 喂食宠物
   */
  async feedPet() {
    const pet = await this.getPetData();
    pet.hunger = Math.max(0, pet.hunger - 20);
    pet.mood = Math.min(100, pet.mood + 15);
    pet.lastFeedTime = Date.now();
    await this.set(this.KEYS.PET_DATA, pet);
    return pet;
  },

  /**
   * 更新宠物心情（定期调用，根据时间衰减）
   */
  async updatePetMood() {
    const pet = await this.getPetData();
    const now = Date.now();
    const lastUpdate = pet.lastMoodUpdate || now;
    const hours = (now - lastUpdate) / (1000 * 60 * 60);
    
    // 每小时心情下降 5 点，饥饿度上升 3 点
    pet.mood = Math.max(0, pet.mood - (hours * 5));
    pet.hunger = Math.min(100, pet.hunger + (hours * 3));
    pet.lastMoodUpdate = now;
    
    await this.set(this.KEYS.PET_DATA, pet);
    return pet;
  },

  /**
   * 获取宠物成长统计
   */
  async getPetStats() {
    const stats = await this.get(this.KEYS.PET_STATS);
    return stats || {
      totalFedTimes: 0,
      totalLevelUp: 0,
      createdAt: Date.now(),
    };
  },

  // ==================== 用户设置 ====================
  /**
   * 获取用户设置
   */
  async getUserSettings() {
    const settings = await this.get(this.KEYS.USER_SETTINGS);
    return settings || {
      enableNotifications: true,
      enablePet: true,
      enableAnalytics: true,
      theme: 'light',
    };
  },

  /**
   * 更新用户设置
   */
  async updateUserSettings(updates) {
    const current = await this.getUserSettings();
    const updated = { ...current, ...updates };
    await this.set(this.KEYS.USER_SETTINGS, updated);
    return updated;
  },

  // ==================== 工具方法 ====================
  /**
   * 获取今天的键（格式：YYYY-MM-DD）
   */
  getTodayKey() {
    return this.KEYS.DAILY_STATS + '_' + this.getDateString(new Date());
  },

  /**
   * 获取指定日期的键
   */
  getDayKey(date) {
    return this.KEYS.DAILY_STATS + '_' + this.getDateString(date);
  },

  /**
   * 日期转字符串（YYYY-MM-DD）
   */
  getDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * 格式化时长（秒数转为 h/min/s）
   */
  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  },

  /**
   * 导出所有数据（备份）
   */
  async exportData() {
    return await this.getAll();
  },

  /**
   * 导入数据（恢复备份）
   */
  async importData(data) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.set(data, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(true);
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  },
};

// 导出为模块（在需要的地方引入使用）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Storage;
}
