const LLM_BACKEND_URL = 'https://your-backend-server.com/api/llm'; // 后端服务地址

class LLMClient {
  constructor(config = {}) {
    this.model = config.model || 'gpt-4'; // 默认模型
    this.timeout = config.timeout || 30000;
  }

  /**
   * 调用 LLM - 通过后端服务器代理（避免暴露 API 密钥）
   * @param {string} prompt - 用户提示词
   * @param {object} options - 额外选项
   * @returns {Promise<string>} - LLM 响应
   */
  async chat(prompt, options = {}) {
    try {
      const response = await fetch(LLM_BACKEND_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          model: options.model || this.model,
          temperature: options.temperature || 0.7,
          maxTokens: options.maxTokens || 2000,
          userId: await this.getUserId(), // 用于后端追踪和限流
        }),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        throw new Error(`LLM API error: ${response.status}`);
      }

      const data = await response.json();
      return data.content || data.message;
    } catch (error) {
      console.error('LLM request failed:', error);
      throw error;
    }
  }

  /**
   * 流式调用 LLM
   */
  async streamChat(prompt, onChunk, options = {}) {
    try {
      const response = await fetch(LLM_BACKEND_URL + '/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          model: options.model || this.model,
          userId: await this.getUserId(),
        }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        onChunk(chunk);
      }
    } catch (error) {
      console.error('Stream LLM request failed:', error);
      throw error;
    }
  }

  /**
   * 获取用户 ID（用于后端识别和限流）
   */
  async getUserId() {
    const { userId } = await chrome.storage.sync.get('userId');
    return userId || 'anonymous';
  }

  /**
   * 切换模型
   */
  setModel(model) {
    this.model = model;
  }

  /**
   * 获取可用模型列表（从后端获取）
   */
  async getAvailableModels() {
    try {
      const response = await fetch(LLM_BACKEND_URL + '/models');
      const data = await response.json();
      return data.models || [];
    } catch (error) {
      console.error('Failed to fetch models:', error);
      return ['deepseek', 'qwen', 'zhipu'];
    }
  }

  /**
   * 使用提示词进行 AI 辅助（通用方法）
   * @param {string} prompt - 提示词模板
   * @param {string} userCode - 用户代码
   * @param {string} userProblem - 用户问题描述
   * @param {object} options - 其他选项
   * @returns {Promise<object>} - JSON 格式的回复
   */
  async assistWithPrompt(prompt, userCode, userProblem, options = {}) {
    try {
      const combinedPrompt = this.constructPrompt(
        prompt,
        userCode,
        userProblem,
        options
      );

      const response = await this.chat(combinedPrompt, {
        model: options.model || this.model,
        temperature: 0.6, // 辅助任务使用较低温度保证质量
        maxTokens: options.maxTokens || 2500,
      });

      // 尝试解析 JSON 响应
      try {
        return JSON.parse(response);
      } catch (e) {
        // 如果不是 JSON，包装成 JSON 格式
        return {
          type: options.type || 'general',
          content: response,
          raw: true,
        };
      }
    } catch (error) {
      console.error('Assist with prompt failed:', error);
      throw error;
    }
  }

  /**
   * 构造完整提示词
   */
  constructPrompt(basePrompt, userCode, userProblem, options = {}) {
    return `${basePrompt}

用户问题描述：
${userProblem}

用户代码：
\`\`\`${options.language || 'javascript'}
${userCode}
\`\`\`

请用 JSON 格式返回你的分析结果。确保返回的是有效的 JSON。`;
  }

  /**
   * 问题引导
   */
  async guideOnProblem(userCode, userProblem, prompt) {
    return this.assistWithPrompt(prompt, userCode, userProblem, {
      type: 'guide',
      language: 'javascript',
    });
  }

  /**
   * 思路提示
   */
  async suggestIdea(userCode, userProblem, prompt) {
    return this.assistWithPrompt(prompt, userCode, userProblem, {
      type: 'idea',
      language: 'javascript',
      temperature: 0.5,
    });
  }

  /**
   * 代码纠错
   */
  async fixCode(userCode, userProblem, prompt) {
    return this.assistWithPrompt(prompt, userCode, userProblem, {
      type: 'code_fix',
      language: 'javascript',
      maxTokens: 3000,
    });
  }

  /**
   * 知识点识别
   */
  async identifyKnowledge(userCode, userProblem, prompt) {
    return this.assistWithPrompt(prompt, userCode, userProblem, {
      type: 'knowledge_tag',
      language: 'javascript',
    });
  }
}

// 导出单例
const llmClient = new LLMClient();
