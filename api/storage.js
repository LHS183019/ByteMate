/**
 * 统一的存储管理模块
 * 整合了原有的storageManager和Storage对象的功能
 * 使用策略模式支持local和sync两种存储方式
 */

class StorageManager {
  constructor() {
    // 定义所有存储键常量
    this.STORAGE_KEYS = {
      // 原有storageManager的键
      USER_ID: 'userId',
      PROGRESS: 'userProgress',
      KNOWLEDGE_TAGS: 'knowledgeTags',
      PET_STATUS: 'petStatus',
      SETTINGS: 'userSettings',
      LAST_SYNC: 'lastSync',
      
      // Dashboard的键
      LEARNING_STATS: 'oj_learning_stats',
      DAILY_STATS: 'oj_daily_stats',
      PROBLEMS_SOLVED: 'oj_problems_solved',
      PROBLEM_DETAILS: 'oj_problem_details_',
      PET_DATA: 'oj_pet_data',
      PET_STATS: 'oj_pet_stats',
      KNOWLEDGE_TAGS_DASHBOARD: 'oj_knowledge_tags',
      TAG_PROGRESS: 'oj_tag_progress_',
      USER_SETTINGS: 'oj_user_settings',
      LAST_UPDATE: 'oj_last_update',
    };
    
    // 初始化存储策略
    this.syncStorage = new ChromeStorageStrategy('sync');
    this.localStorage = new ChromeStorageStrategy('local');
    
    // 标记是否已初始化
    this.isInitialized = false;
  }
  
  /**
   * 初始化存储，检查并创建必要的数据结构
   */
  async init() {
    if (this.isInitialized) return true;
    
    try {
      const existing = await this.localStorage.getAll();
      
      // 初始化学习统计
      if (!existing[this.STORAGE_KEYS.LEARNING_STATS]) {
        await this.localStorage.set(this.STORAGE_KEYS.LEARNING_STATS, {
          totalProblems: 0,
          totalDuration: 0,        // 秒
          successRate: 0,
          knowledgeCount: 0,
          createdAt: Date.now(),
        });
      }

      // 初始化宠物数据
      if (!existing[this.STORAGE_KEYS.PET_DATA]) {
        await this.localStorage.set(this.STORAGE_KEYS.PET_DATA, {
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
      if (!existing[this.STORAGE_KEYS.KNOWLEDGE_TAGS_DASHBOARD]) {
        await this.localStorage.set(this.STORAGE_KEYS.KNOWLEDGE_TAGS_DASHBOARD, {});
      }

      this.isInitialized = true;
      console.log('✓ 存储初始化完成');
      return true;
    } catch (e) {
      console.error('存储初始化失败:', e);
      return false;
    }
  }

  // ==================== 原有storageManager接口（兼容层） ====================
  /**
   * 保存用户学习进度
   * @param {string} problemId - 问题ID
   * @param {object} progressData - 进度信息
   */
  async saveProgress(problemId, progressData) {
    try {
      const existing = await this.getProgress();
      const updated = {
        ...existing,
        [problemId]: {
          ...progressData,
          updatedAt: Date.now(),
        },
      };
      await this.syncStorage.set(this.STORAGE_KEYS.PROGRESS, updated);
      
      // 同时更新Dashboard的统计
      await this.recordProblemSolved(problemId, progressData);
      
      return true;
    } catch (error) {
      console.error('Save progress failed:', error);
      return false;
    }
  }

  /**
   * 获取用户学习进度
   */
  async getProgress() {
    try {
      return await this.syncStorage.get(this.STORAGE_KEYS.PROGRESS) || {};
    } catch (error) {
      console.error('Get progress failed:', error);
      return {};
    }
  }

  /**
   * 更新知识标签（用户掌握的知识点）
   * @param {array} tags - 标签数组 ['数据结构', '动态规划', ...]
   */
  async updateKnowledgeTags(tags) {
    try {
      // 更新原有存储
      const existing = await this.getKnowledgeTags();
      const updated = [...new Set([...existing, ...tags])]; // 去重合并
      await this.syncStorage.set(this.STORAGE_KEYS.KNOWLEDGE_TAGS, updated);
      
      // 同时更新Dashboard的标签
      for (const tag of tags) {
        await this.addTodayTag(tag);
        await this.recordTagMastery(tag);
      }
      
      return updated;
    } catch (error) {
      console.error('Update knowledge tags failed:', error);
      return [];
    }
  }

  /**
   * 获取知识标签
   */
  async getKnowledgeTags() {
    try {
      return await this.syncStorage.get(this.STORAGE_KEYS.KNOWLEDGE_TAGS) || [];
    } catch (error) {
      console.error('Get knowledge tags failed:', error);
      return [];
    }
  }

  /**
   * 更新宠物状态
   * @param {object} petData - { level, exp, mood, name, lastFed }
   */
  async updatePetStatus(petData) {
    try {
      // 更新原有存储
      const existing = await this.getPetStatus();
      const updated = {
        ...existing,
        ...petData,
        updatedAt: Date.now(),
      };
      await this.syncStorage.set(this.STORAGE_KEYS.PET_STATUS, updated);
      
      // 同时更新Dashboard的宠物数据
      await this.updatePetData(petData);
      
      return updated;
    } catch (error) {
      console.error('Update pet status failed:', error);
      return null;
    }
  }

  /**
   * 获取宠物状态
   */
  async getPetStatus() {
    try {
      return await this.syncStorage.get(this.STORAGE_KEYS.PET_STATUS) || {
        level: 1,
        exp: 0,
        mood: 100,
        name: '学习助手',
        lastFed: Date.now(),
      };
    } catch (error) {
      console.error('Get pet status failed:', error);
      return {};
    }
  }

  /**
   * 保存用户设置
   */
  async saveSettings(settings) {
    try {
      // 更新原有存储
      const existing = await this.getSettings();
      const updated = { ...existing, ...settings };
      await this.syncStorage.set(this.STORAGE_KEYS.SETTINGS, updated);
      
      // 同时更新Dashboard的设置
      await this.updateUserSettings(settings);
      
      return updated;
    } catch (error) {
      console.error('Save settings failed:', error);
      return null;
    }
  }

  /**
   * 获取用户设置
   */
  async getSettings() {
    try {
      return await this.syncStorage.get(this.STORAGE_KEYS.SETTINGS) || {
        theme: 'light',
        language: 'zh-CN',
        notifications: true,
      };
    } catch (error) {
      console.error('Get settings failed:', error);
      return {};
    }
  }

  /**
   * 获取用户ID
   */
  async getUserId() {
    try {
      return await this.syncStorage.get(this.STORAGE_KEYS.USER_ID);
    } catch (error) {
      console.error('Get user id failed:', error);
      return null;
    }
  }

  /**
   * 初始化用户 ID（首次使用）
   */
  async initializeUser() {
    try {
      let userId = await this.syncStorage.get(this.STORAGE_KEYS.USER_ID);
      if (!userId) {
        userId = `user_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;
        await this.syncStorage.set(this.STORAGE_KEYS.USER_ID, userId);
      }
      return userId;
    } catch (error) {
      console.error('Initialize user failed:', error);
      return null;
    }
  }

  // ==================== Dashboard接口 ====================
  // 学习进度管理
  async getLearningStats() {
    const stats = await this.localStorage.get(this.STORAGE_KEYS.LEARNING_STATS);
    return stats || {
      totalProblems: 0,
      totalDuration: 0,
      successRate: 0,
      knowledgeCount: 0,
      createdAt: Date.now(),
    };
  }

  async updateLearningStats(updates) {
    const current = await this.getLearningStats();
    const updated = { ...current, ...updates };
    await this.localStorage.set(this.STORAGE_KEYS.LEARNING_STATS, updated);
    return updated;
  }

  async recordDuration(seconds) {
    const stats = await this.getLearningStats();
    stats.totalDuration += seconds;
    await this.localStorage.set(this.STORAGE_KEYS.LEARNING_STATS, stats);
    
    // 更新今日统计
    await this.addTodayDuration(seconds);
    return stats;
  }

  async recordProblemSolved(problemId, problemData) {
    const stats = await this.getLearningStats();
    stats.totalProblems += 1;
    await this.localStorage.set(this.STORAGE_KEYS.LEARNING_STATS, stats);

    // 保存题目详情
    const key = this.STORAGE_KEYS.PROBLEM_DETAILS + problemId;
    await this.localStorage.set(key, {
      id: problemId,
      ...problemData,
      solvedAt: Date.now(),
    });

    // 更新已解决题目列表
    const solved = await this.localStorage.get(this.STORAGE_KEYS.PROBLEMS_SOLVED) || [];
    if (!solved.includes(problemId)) {
      solved.push(problemId);
      await this.localStorage.set(this.STORAGE_KEYS.PROBLEMS_SOLVED, solved);
    }

    // 更新今日完成数
    await this.addTodayCompletedProblem();

    return stats;
  }

  async getProblemsSolved() {
    const solved = await this.localStorage.get(this.STORAGE_KEYS.PROBLEMS_SOLVED);
    return solved || [];
  }

  async getProblemDetail(problemId) {
    const key = this.STORAGE_KEYS.PROBLEM_DETAILS + problemId;
    return await this.localStorage.get(key);
  }

  // 每日统计管理
  async getTodayStats() {
    const today = this.getTodayKey();
    const stats = await this.localStorage.get(today);
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
  }

  async addTodayCompletedProblem() {
    const today = this.getTodayKey();
    const stats = await this.getTodayStats();
    stats.completedCount += 1;
    await this.localStorage.set(today, stats);
    return stats;
  }

  async addTodayDuration(seconds) {
    const today = this.getTodayKey();
    const stats = await this.getTodayStats();
    stats.duration += seconds;
    await this.localStorage.set(today, stats);
    return stats;
  }

  async addTodayTag(tag) {
    const today = this.getTodayKey();
    const stats = await this.getTodayStats();
    if (!stats.tagsLearned) stats.tagsLearned = [];
    if (!stats.tagsLearned.includes(tag)) {
      stats.tagsLearned.push(tag);
    }
    await this.localStorage.set(today, stats);
    return stats;
  }

  async getRecentDaysStats(days = 7) {
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = this.getDayKey(date);
      const stats = await this.localStorage.get(key);
      result.push({
        date: key,
        completedCount: stats?.completedCount || 0,
        duration: stats?.duration || 0,
      });
    }
    return result;
  }

  // 知识点管理
  async getAllTags() {
    const tags = await this.localStorage.get(this.STORAGE_KEYS.KNOWLEDGE_TAGS_DASHBOARD);
    return tags || {};
  }

  async updateTagProgress(tag, progress) {
    const tags = await this.getAllTags();
    tags[tag] = {
      ...tags[tag],
      name: tag,
      progress: Math.min(100, Math.max(0, progress)),
      lastUpdated: Date.now(),
    };
    await this.localStorage.set(this.STORAGE_KEYS.KNOWLEDGE_TAGS_DASHBOARD, tags);
    return tags;
  }

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
    await this.localStorage.set(this.STORAGE_KEYS.KNOWLEDGE_TAGS_DASHBOARD, tags);
    return tags;
  }

  async getTagsStatistics() {
    const tags = await this.getAllTags();
    return Object.values(tags).map(tag => ({
      name: tag.name,
      value: tag.progress || 0,
      count: tag.count || 0,
    }));
  }

  // 宠物管理
  async getPetData() {
    const pet = await this.localStorage.get(this.STORAGE_KEYS.PET_DATA);
    return pet || {
      name: '学习伙伴',
      level: 1,
      exp: 0,
      mood: 100,
      hunger: 50,
      lastFeedTime: Date.now(),
      createdAt: Date.now(),
    };
  }

  async updatePetData(updates) {
    const pet = await this.getPetData();
    const updated = { ...pet, ...updates };
    await this.localStorage.set(this.STORAGE_KEYS.PET_DATA, updated);
    return updated;
  }

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
    
    await this.localStorage.set(this.STORAGE_KEYS.PET_DATA, pet);
    return pet;
  }

  async feedPet() {
    const pet = await this.getPetData();
    pet.hunger = Math.max(0, pet.hunger - 20);
    pet.mood = Math.min(100, pet.mood + 15);
    pet.lastFeedTime = Date.now();
    await this.localStorage.set(this.STORAGE_KEYS.PET_DATA, pet);
    return pet;
  }

  async updatePetMood() {
    const pet = await this.getPetData();
    const now = Date.now();
    const lastUpdate = pet.lastMoodUpdate || now;
    const hours = (now - lastUpdate) / (1000 * 60 * 60);
    
    // 每小时心情下降 5 点，饥饿度上升 3 点
    pet.mood = Math.max(0, pet.mood - (hours * 5));
    pet.hunger = Math.min(100, pet.hunger + (hours * 3));
    pet.lastMoodUpdate = now;
    
    await this.localStorage.set(this.STORAGE_KEYS.PET_DATA, pet);
    return pet;
  }

  async getPetStats() {
    const stats = await this.localStorage.get(this.STORAGE_KEYS.PET_STATS);
    return stats || {
      totalFedTimes: 0,
      totalLevelUp: 0,
      createdAt: Date.now(),
    };
  }

  // 用户设置
  async getUserSettings() {
    const settings = await this.localStorage.get(this.STORAGE_KEYS.USER_SETTINGS);
    return settings || {
      enableNotifications: true,
      enablePet: true,
      enableAnalytics: true,
      theme: 'light',
    };
  }

  async updateUserSettings(updates) {
    const current = await this.getUserSettings();
    const updated = { ...current, ...updates };
    await this.localStorage.set(this.STORAGE_KEYS.USER_SETTINGS, updated);
    return updated;
  }

  // 辅助函数
  getTodayKey() {
    return this.STORAGE_KEYS.DAILY_STATS + '_' + this.getDateString(new Date());
  }

  getDayKey(date) {
    return this.STORAGE_KEYS.DAILY_STATS + '_' + this.getDateString(date);
  }

  getDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

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
  }

  // 数据管理
  async exportData() {
    return await this.localStorage.getAll();
  }

  async importData(data) {
    return await this.localStorage.setMultiple(data);
  }

  /**
   * 清空所有数据（谨慎使用）
   */
  async clearAll() {
    try {
      await this.syncStorage.clear();
      await this.localStorage.clear();
      return true;
    } catch (error) {
      console.error('Clear storage failed:', error);
      return false;
    }
  }
}

/**
 * Chrome存储策略类
 * 使用策略模式封装不同的存储方式
 */
class ChromeStorageStrategy {
  constructor(type) {
    this.storage = type === 'sync' ? chrome.storage.sync : chrome.storage.local;
  }

  /**
   * 设置单个值
   */
  async set(key, value) {
    return new Promise((resolve, reject) => {
      try {
        const obj = {};
        obj[key] = value;
        this.storage.set(obj, () => {
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
  }

  /**
   * 设置多个值
   */
  async setMultiple(data) {
    return new Promise((resolve, reject) => {
      try {
        this.storage.set(data, () => {
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
  }

  /**
   * 获取值
   */
  async get(key) {
    return new Promise((resolve, reject) => {
      try {
        this.storage.get([key], (items) => {
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
  }

  /**
   * 获取所有数据
   */
  async getAll() {
    return new Promise((resolve, reject) => {
      try {
        this.storage.get(null, (items) => {
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
  }

  /**
   * 删除值
   */
  async remove(key) {
    return new Promise((resolve, reject) => {
      try {
        this.storage.remove(key, () => {
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
  }

  /**
   * 清空所有存储
   */
  async clear() {
    return new Promise((resolve, reject) => {
      try {
        this.storage.clear(() => {
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
  }
}

// 导出单例
const storageManager = new StorageManager();

// 导出为模块（在需要的地方引入使用）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = storageManager;
}

// 也导出Storage对象以保持向后兼容
const Storage = storageManager;

// ============ 轻量适配层（供 popup 等简单场景使用） ============
// 提供 setStorageType/getItem/setItem 等通用方法，兼容现有 popup.js 的用法
let __currentStrategy = new ChromeStorageStrategy('local');

async function __setStorageType(type) {
  __currentStrategy = new ChromeStorageStrategy(type === 'sync' ? 'sync' : 'local');
  return true;
}

async function __getItem(key) {
  return await __currentStrategy.get(key);
}

async function __setItem(key, value) {
  return await __currentStrategy.set(key, value);
}

async function __removeItem(key) {
  return await __currentStrategy.remove(key);
}

async function __getAll() {
  return await __currentStrategy.getAll();
}

const storageManagerForPopup = {
  setStorageType: __setStorageType,
  getItem: __getItem,
  setItem: __setItem,
  removeItem: __removeItem,
  getAll: __getAll,
};

// 创建一个包装器，保持向后兼容
const StorageManagerWrapper = {
  // 新API方法
  setStorageType: __setStorageType,
  getItem: __getItem,
  setItem: __setItem,
  removeItem: __removeItem,
  getAll: __getAll,
  
  // 保持兼容性，代理到主实例
  async init() {
    return await storageManager.init();
  },
  
  async saveProgress(problemId, progressData) {
    return await storageManager.saveProgress(problemId, progressData);
  },
  
  async getProgress() {
    return await storageManager.getProgress();
  },
  
  async updateKnowledgeTags(tags) {
    return await storageManager.updateKnowledgeTags(tags);
  },
  
  async getKnowledgeTags() {
    return await storageManager.getKnowledgeTags();
  },
  
  async updatePetStatus(petData) {
    return await storageManager.updatePetStatus(petData);
  },
  
  async getPetStatus() {
    return await storageManager.getPetStatus();
  },
  
  async saveSettings(settings) {
    return await storageManager.saveSettings(settings);
  },
  
  async getSettings() {
    return await storageManager.getSettings();
  },
  
  async getUserId() {
    return await storageManager.getUserId();
  },
  
  async initializeUser() {
    return await storageManager.initializeUser();
  }
};

// 以 ES Module 形式导出，供 extension 页面通过 <script type="module"> 引入
export { StorageManagerWrapper as StorageManager };
