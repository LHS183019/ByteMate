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
   * 问题引导 - 修改：返回文字而非JSON
   * @param {string} userCode - 用户代码
   * @param {string} userProblem - 问题描述
   * @returns {Promise<string>} - 文字格式的引导
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
      return this.normalizeTextResponse(result, 'guide'); // 修改：使用新的文本响应处理方法
    } catch (error) {
      console.error('Get problem guide failed:', error);
      throw error;
    }
  }

  /**
   * 思路提示 - 修改：返回文字而非JSON
   * @param {string} userCode - 用户代码
   * @param {string} userProblem - 问题描述
   * @returns {Promise<string>} - 文字格式的思路
   */
  async getSolutionIdea(userCode, userProblem) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const prompt = this.prompts.getPrompt('idea');
      const result = await this.llm.suggestIdea(userCode, userProblem, prompt);
      return this.normalizeTextResponse(result, 'idea'); // 修改：使用新的文本响应处理方法
    } catch (error) {
      console.error('Get solution idea failed:', error);
      throw error;
    }
  }

  /**
   * 代码纠错 - 修改：返回文字而非JSON
   * @param {string} userCode - 用户代码
   * @param {string} userProblem - 问题描述
   * @returns {Promise<string>} - 文字格式的纠错结果
   */
  async getCodeFix(userCode, userProblem) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const prompt = this.prompts.getPrompt('code_fix');
      const result = await this.llm.fixCode(userCode, userProblem, prompt);
      return this.normalizeTextResponse(result, 'code_fix'); // 修改：使用新的文本响应处理方法
    } catch (error) {
      console.error('Get code fix failed:', error);
      throw error;
    }
  }

  /**
   * 知识点识别与分类 - 修改：返回文字而非JSON
   * @param {string} userCode - 用户代码
   * @param {string} userProblem - 问题描述
   * @returns {Promise<string>} - 文字格式的知识点分析
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
      
      // 修改：不再提取标签，因为现在是文字输出
      // 如果需要保存知识点，可以保留但调整逻辑
      // await StorageManager.updateKnowledgeTags(this.extractTagsFromText(result));

      return this.normalizeTextResponse(result, 'knowledge_tag'); // 修改：使用新的文本响应处理方法
    } catch (error) {
      console.error('Get knowledge tags failed:', error);
      throw error;
    }
  }

  /**
   * 处理题目信息（从后端接收）- 修改：返回文字而非JSON
   * @param {object} problemInfo - 后端提供的题目信息
   * @returns {Promise<string>} - 文字格式的 AI 输出
   */
  async processProblemInfo(problemInfo) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const prompt = this.prompts.getPrompt(problemInfo.feature);
      const result = await this.llm.assistProblem(problemInfo, prompt);

      return this.normalizeTextResponse(result, problemInfo.feature); // 修改：使用新的文本响应处理方法
    } catch (error) {
      console.error('Process problem info failed:', error);
      throw error;
    }
  }

  /**
   * 规范化文本响应格式 - 新增：专门处理文字输出的方法
   */
  normalizeTextResponse(result, type) {
    // 如果已经是字符串，直接返回
    if (typeof result === 'string') {
      return result;
    }

    // 如果是对象，转换为字符串
    if (typeof result === 'object') {
      // 如果有content字段，优先使用
      if (result.content) {
        return result.content;
      }
      // 否则尝试JSON.stringify
      try {
        return JSON.stringify(result, null, 2);
      } catch (e) {
        return String(result);
      }
    }

    // 其他情况转换为字符串
    return String(result);
  }

  /**
   * 保留原有的JSON响应方法，以备不时之需
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
   * 从文本中提取标签（如果需要）- 修改：适应文字输出
   */
  extractTagsFromText(text) {
    // 简化版的标签提取逻辑，根据实际需求调整
    const tags = [];
    const commonTags = ['变量', '循环', '条件', '函数', '数组', '字符串', '算法', '数据结构'];
    
    commonTags.forEach(tag => {
      if (text.includes(tag)) {
        tags.push(tag);
      }
    });
    
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