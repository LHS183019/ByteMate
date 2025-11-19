class StorageManager {
  constructor() {
    this.STORAGE_KEYS = {
      USER_ID: 'userId',
      PROGRESS: 'userProgress',
      KNOWLEDGE_TAGS: 'knowledgeTags',
      PET_STATUS: 'petStatus',
      SETTINGS: 'userSettings',
      LAST_SYNC: 'lastSync',
    };
  }

  /**
   * 保存用户学习进度
   * @param {object} progress - 进度信息 { problemId, status, score, timestamp }
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
      await chrome.storage.sync.set({
        [this.STORAGE_KEYS.PROGRESS]: updated,
      });
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
      const data = await chrome.storage.sync.get(
        this.STORAGE_KEYS.PROGRESS
      );
      return data[this.STORAGE_KEYS.PROGRESS] || {};
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
      const existing = await this.getKnowledgeTags();
      const updated = [...new Set([...existing, ...tags])]; // 去重合并
      await chrome.storage.sync.set({
        [this.STORAGE_KEYS.KNOWLEDGE_TAGS]: updated,
      });
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
      const data = await chrome.storage.sync.get(
        this.STORAGE_KEYS.KNOWLEDGE_TAGS
      );
      return data[this.STORAGE_KEYS.KNOWLEDGE_TAGS] || [];
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
      const existing = await this.getPetStatus();
      const updated = {
        ...existing,
        ...petData,
        updatedAt: Date.now(),
      };
      await chrome.storage.sync.set({
        [this.STORAGE_KEYS.PET_STATUS]: updated,
      });
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
      const data = await chrome.storage.sync.get(
        this.STORAGE_KEYS.PET_STATUS
      );
      return (
        data[this.STORAGE_KEYS.PET_STATUS] || {
          level: 1,
          exp: 0,
          mood: 100,
          name: '学习助手',
          lastFed: Date.now(),
        }
      );
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
      const existing = await this.getSettings();
      const updated = { ...existing, ...settings };
      await chrome.storage.sync.set({
        [this.STORAGE_KEYS.SETTINGS]: updated,
      });
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
      const data = await chrome.storage.sync.get(
        this.STORAGE_KEYS.SETTINGS
      );
      return (
        data[this.STORAGE_KEYS.SETTINGS] || {
          theme: 'light',
          language: 'zh-CN',
          notifications: true,
        }
      );
    } catch (error) {
      console.error('Get settings failed:', error);
      return {};
    }
  }

  /**
   * 初始化用户 ID（首次使用）
   */
  async initializeUser() {
    try {
      const data = await chrome.storage.sync.get(
        this.STORAGE_KEYS.USER_ID
      );
      if (!data[this.STORAGE_KEYS.USER_ID]) {
        const userId = `user_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;
        await chrome.storage.sync.set({
          [this.STORAGE_KEYS.USER_ID]: userId,
        });
        return userId;
      }
      return data[this.STORAGE_KEYS.USER_ID];
    } catch (error) {
      console.error('Initialize user failed:', error);
      return null;
    }
  }

  /**
   * 清空所有数据（谨慎使用）
   */
  async clearAll() {
    try {
      await chrome.storage.sync.clear();
      return true;
    } catch (error) {
      console.error('Clear storage failed:', error);
      return false;
    }
  }
}

// 导出单例
const storageManager = new StorageManager();
