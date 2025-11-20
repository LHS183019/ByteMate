class PromptManager {
  constructor() {
    this.prompts = {};
    this.loaded = false;
  }

  /**
   * 初始化提示词（从 prompts 文件夹加载）
   */
  async initialize() {
    try {
      this.prompts = {
        guide: await this.loadPrompt('guide'),
        idea: await this.loadPrompt('idea'),
        code_fix: await this.loadPrompt('code_fix'),
        knowledge_tag: await this.loadPrompt('knowledge_tag'),
      };
      this.loaded = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize prompts:', error);
      // 加载失败时使用默认提示词
      this.prompts = this.getDefaultPrompts();
      this.loaded = true;
      return false;
    }
  }

  /**
   * 从文件加载提示词
   */
  async loadPrompt(type) {
    try {
      const filename = this.getFilename(type);
      const response = await fetch(
        chrome.runtime.getURL(`../prompts/${filename}`)
      );
      if (!response.ok) {
        throw new Error(`Failed to load ${filename}`);
      }
      return await response.text();
    } catch (error) {
      console.warn(`Could not load ${type} prompt, using default:`, error);
      return this.getDefaultPrompt(type);
    }
  }

  /**
   * 获取文件名
   */
  getFilename(type) {
    const filenames = {
      guide: 'guide.txt',
      idea: 'idea.txt',
      code_fix: 'code_fix.txt',
      knowledge_tag: 'knowledge_tag.txt',
    };
    return filenames[type] || `${type}.txt`;
  }

  /**
   * 获取指定类型的提示词
   */
  getPrompt(type) {
    if (!this.loaded) {
      console.warn('PromptManager not initialized');
      return this.getDefaultPrompt(type);
    }
    return this.prompts[type] || this.getDefaultPrompt(type);
  }

  /**
   * 默认提示词（备用）
   */
  getDefaultPrompts() {
    return {
      guide: this.getDefaultPrompt('guide'),
      idea: this.getDefaultPrompt('idea'),
      code_fix: this.getDefaultPrompt('code_fix'),
      knowledge_tag: this.getDefaultPrompt('knowledge_tag'),
    };
  }

  /**
   * 获取单个默认提示词
   */
  getDefaultPrompt(type) {
    const defaults = {
      guide: `你是一个编程教师。用户遇到了一个编程问题，你需要引导用户独立思考和解决问题。请分析用户的代码和问题描述，提供回复。回复内容包括：
1. 你需要理解的第一个关键点是什么？提供一个不直接给出答案的提示。
2. 基于第一步，下一步应该考虑什么？给出下一步的启发性提示。
3. 建议的思考方向。
要求：
- **请回复一段文字，不要用json格式**
- **只给出文字提示，不允许提供代码和直接的答案**
- 通过问题引导用户思考
- 鼓励用户独立完成任务
- 语气热情温暖，要给用户提供充足的情绪价值
- **请用中文回答！！**
`,

      idea: `你是一个编程顾问。用户在解决一个编程问题时需要思路上的帮助。请分析用户的代码和问题描述，给出如下内容的回复：
1. 问题的总体思路描述。
2. 给出若干种算法，分析时间和空间复杂度。
3. 比较不同方法的优缺点。
要求：
- **请回复一段文字，不要用json格式**
- **只给出文字提示，不允许提供代码**
- 重点是思路而非实现细节
- 语气热情温暖，要给用户提供充足的情绪价值
- **请用中文回答！！**
`,

      code_fix: `你是一个资深代码审查专家。用户提交了代码但可能存在问题。请分析用户的代码，做出问题的回复：包括内容：
1. 问题出在哪？简要描述代码问题。
2. 如何修复这个问题，提供改进建议。
3. 评价一下用户的代码，温柔热情地说出用户代码做得好的部分，和代码中需要改进的部分。
要求：
- **请回复一段文字，不要用json格式**
- **只给出文字提示，不允许提供代码**
- 提供清晰的修复方案
- 包含性能和最佳实践建议
- 要鼓励和建设性
- 语气热情温暖，要给用户提供充足的情绪价值
- **请用中文回答！！**`,

      knowledge_tag: `你是一个计算机科学教育专家。分析用户的代码和问题，对涉及的知识点进行识别与分类。回答内容包括：
1. 这个问题涉及的主要知识领域。
2. 这个知识点在问题中的具体应用。
3. 用户进一步学习掌握知识点的学习方法建议。
要求：
- **请回复一段文字，不要用json格式**
- 按知识领域分类（数据结构、算法、编程基础等）
- 标注每个知识点的相关程度
- 提供学习建议和相关问题推荐
- 帮助用户建立知识体系
- 语气热情温暖，要给用户提供充足的情绪价值
- **请用中文回答！！**
- **只给出文字提示，不允许提供代码**
`,
    };
    return defaults[type] || '';
  }

  /**
   * 获取所有提示词类型
   */
  getAvailableTypes() {
    return ['guide', 'idea', 'code_fix', 'knowledge_tag'];
  }
}

// 导出单例
const promptManager = new PromptManager();
