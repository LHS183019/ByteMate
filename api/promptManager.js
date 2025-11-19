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
        chrome.runtime.getURL(`prompts/${filename}`)
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
      guide: `你是一个编程教师。用户遇到了一个编程问题，你需要引导用户独立思考。
请分析代码并提供以下 JSON 格式的回复，包含 steps、keyPoints 和 suggestedApproach 字段。
不要直接给出答案，而是通过问题引导用户思考。`,

      idea: `你是一个编程顾问。用户需要思路上的帮助。
请分析代码并提供以下 JSON 格式的回复，包含 overview、approaches（至少2种）、pseudocode 和 recommendation 字段。
对比不同方法的优缺点。`,

      code_fix: `你是一个代码审查专家。请分析用户的代码。
请提供以下 JSON 格式的回复，包含 hasErrors、errors 数组和 improvements 数组。
按严重程度分类错误，并给出修复方案。`,

      knowledge_tag: `你是一个计算机科学教育专家。分析代码并识别涉及的知识点。
请提供以下 JSON 格式的回复，包含 tags（按类别分类）、learningPath 和 relatedProblems 字段。
帮助用户建立知识体系。`,
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
