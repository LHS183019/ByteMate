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
}

// 导出单例
const llmClient = new LLMClient();
