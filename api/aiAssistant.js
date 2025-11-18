class AIAssistant {
  constructor() {
    this.llm = llmClient;
    this.prompts = promptManager;
    this.initialized = false;
  }

  /**
   * 初始化 AI 辅助服务
   */
  async initialize() {
    try {
      await this.prompts.initialize();
      this.initialized = true;
      console.log('AIAssistant initialized successfully');
      return true;
    } catch (error) {
      console.error('AIAssistant initialization failed:', error);
      return false;
    }
  }

  /**
   * 问题引导
   * @param {string} userCode - 用户代码
   * @param {string} userProblem - 问题描述
   * @returns {Promise<object>} - JSON 格式的引导
   */
  async getProblemGuide(userCode, userProblem) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const prompt = this.prompts.getPrompt('guide');
      const result = await this.llm.guideOnProblem(
        userCode,
        userProblem,
        prompt
      );
      return this.normalizeResponse(result, 'guide');
    } catch (error) {
      console.error('Get problem guide failed:', error);
      throw error;
    }
  }

  /**
   * 思路提示
   * @param {string} userCode - 用户代码
   * @param {string} userProblem - 问题描述
   * @returns {Promise<object>} - JSON 格式的思路
   */
  async getSolutionIdea(userCode, userProblem) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const prompt = this.prompts.getPrompt('idea');
      const result = await this.llm.suggestIdea(userCode, userProblem, prompt);
      return this.normalizeResponse(result, 'idea');
    } catch (error) {
      console.error('Get solution idea failed:', error);
      throw error;
    }
  }

  /**
   * 代码纠错
   * @param {string} userCode - 用户代码
   * @param {string} userProblem - 问题描述
   * @returns {Promise<object>} - JSON 格式的纠错结果
   */
  async getCodeFix(userCode, userProblem) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const prompt = this.prompts.getPrompt('code_fix');
      const result = await this.llm.fixCode(userCode, userProblem, prompt);
      return this.normalizeResponse(result, 'code_fix');
    } catch (error) {
      console.error('Get code fix failed:', error);
      throw error;
    }
  }

  /**
   * 知识点识别与分类
   * @param {string} userCode - 用户代码
   * @param {string} userProblem - 问题描述
   * @returns {Promise<object>} - JSON 格式的知识点分析
   */
  async getKnowledgeTags(userCode, userProblem) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const prompt = this.prompts.getPrompt('knowledge_tag');
      const result = await this.llm.identifyKnowledge(
        userCode,
        userProblem,
        prompt
      );
      
      // 获取知识标签并保存
      const tags = this.extractTagsFromResult(result);
      await storageManager.updateKnowledgeTags(tags);

      return this.normalizeResponse(result, 'knowledge_tag');
    } catch (error) {
      console.error('Get knowledge tags failed:', error);
      throw error;
    }
  }

  /**
   * 规范化响应格式
   */
  normalizeResponse(result, type) {
    // 如果已经是 JSON 对象
    if (typeof result === 'object') {
      return {
        success: true,
        type,
        timestamp: Date.now(),
        data: result,
      };
    }

    // 如果是字符串，尝试解析
    try {
      const parsed = JSON.parse(result);
      return {
        success: true,
        type,
        timestamp: Date.now(),
        data: parsed,
      };
    } catch (e) {
      return {
        success: true,
        type,
        timestamp: Date.now(),
        data: {
          content: result,
          raw: true,
        },
      };
    }
  }

  /**
   * 从知识点识别结果中提取标签
   */
  extractTagsFromResult(result) {
    const tags = [];
    if (result.tags && Array.isArray(result.tags)) {
      result.tags.forEach((category) => {
        if (category.items && Array.isArray(category.items)) {
          category.items.forEach((item) => {
            if (item.name && item.relevance === '高') {
              tags.push(`${category.category}:${item.name}`);
            }
          });
        }
      });
    }
    return tags;
  }

  /**
   * 获取所有可用的辅助类型
   */
  getAvailableAssistance() {
    return [
      {
        id: 'guide',
        name: '问题引导',
        description: '通过提问引导你独立思考和解决问题',
      },
      {
        id: 'idea',
        name: '思路提示',
        description: '提供多种解决方案和算法思路的对比分析',
      },
      {
        id: 'code_fix',
        name: '代码纠错',
        description: '检查代码中的错误并提供修复建议',
      },
      {
        id: 'knowledge_tag',
        name: '知识点识别与分类',
        description: '识别问题涉及的知识点并规划学习路径',
      },
    ];
  }
}

// 导出单例
const aiAssistant = new AIAssistant();
