// 后端服务器地址（用户需要启动后端服务）
const LLM_BACKEND_URL = 'http://localhost:3000/api/llm';
const LLM_BACKEND_STREAM = 'http://localhost:3000/api/llm/stream';
const LLM_MODELS_URL = 'http://localhost:3000/api/llm/models';
const LLM_HEALTH_URL = 'http://localhost:3000/api/health';

class LLMClient {
  constructor(config = {}) {
    this.model = config.model || 'deepseek';
    this.timeout = config.timeout || 30000;
    this.backendUrl = config.backendUrl || LLM_BACKEND_URL;
    console.log('[LLMClient] Initialized with backend URL:', this.backendUrl);
  }

  /**
   * 检查后端服务健康状态
   */
  async checkHealth() {
    try {
      const response = await fetch(LLM_HEALTH_URL, {
        method: 'GET',
        timeout: 5000,
      });
      const data = await response.json();
      return data.hasValidConfig;
    } catch (error) {
      console.error('Backend health check failed:', error);
      return false;
    }
  }

  /**
   * 调用 LLM - 通过后端服务器代理
   */
  async chat(prompt, options = {}) {
    try {
      const response = await fetch(this.backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          model: options.model || this.model,
          temperature: options.temperature || 0.7,
          maxTokens: options.maxTokens || 2000,
          userId: await this.getUserId(),
        }),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || '请求失败');
      }

      return data.content;
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
      const response = await fetch(LLM_BACKEND_STREAM, {
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

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n');

        lines.forEach((line) => {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                onChunk(data.content);
              }
              if (data.done) {
                onChunk(null); // 信号流结束
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        });
      }
    } catch (error) {
      console.error('Stream LLM request failed:', error);
      throw error;
    }
  }

  /**
   * 获取用户 ID
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
   * 获取可用模型列表
   */
  async getAvailableModels() {
    try {
      const response = await fetch(LLM_MODELS_URL);
      const data = await response.json();
      return data.models || [];
    } catch (error) {
      console.error('Failed to fetch models:', error);
      return [];
    }
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

  /**
   * 使用提示词进行 AI 辅助（通用方法）- 修改：返回文字而非JSON
   * @param {string} prompt - 提示词模板
   * @param {string} userCode - 用户代码
   * @param {string} userProblem - 用户问题描述
   * @param {object} options - 其他选项
   * @returns {Promise<string>} - 文字格式的回复
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

      // 修改：直接返回响应内容，不解析JSON
      return response;
    } catch (error) {
      console.error('Assist with prompt failed:', error);
      throw error;
    }
  }

  /**
   * 构造完整提示词 - 修改：移除JSON格式要求
   */
  constructPrompt(basePrompt, userCode, userProblem, options = {}) {
    // 修改：移除JSON格式要求，让AI返回自然语言
    return `${basePrompt}

用户问题描述：
${userProblem}

用户代码：
\`\`\`${options.language || 'javascript'}
${userCode}
\`\`\`

请用清晰易懂的文字回复，不要使用JSON格式。`;
  }

  /**
   * 处理题目辅助请求（统一接口）- 修改：返回文字
   */
  async assistProblem(problemInfo, customPrompt = null) {
    try {
      console.log('[assistProblem] Starting request with:', {
        feature: problemInfo.feature,
        problemId: problemInfo.problemId,
        codeLength: problemInfo.currentCode?.length,
      });

      const assistUrl = `${this.backendUrl.replace('/api/llm', '')}/api/assist`;
      console.log('[assistProblem] URL:', assistUrl);

      const response = await fetch(assistUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          feature: problemInfo.feature,
          title: problemInfo.title,
          statement: problemInfo.statement,
          currentCode: problemInfo.currentCode || '',
          samples: problemInfo.samples || [],
          problemId: problemInfo.problemId,
          customPrompt,
          userId: await this.getUserId(),
          // 修改：告诉后端需要文字回复而非JSON
          responseFormat: 'text'
        }),
        signal: AbortSignal.timeout(this.timeout),
      });

      console.log('[assistProblem] Response status:', response.status);

      if (!response.ok) {
        const error = await response.json();
        console.error('[assistProblem] Error response:', error);
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('[assistProblem] Success response:', {
        success: data.success,
        feature: data.feature,
        resultType: typeof data.result,
      });

      if (!data.success) {
        throw new Error(data.error || '请求失败');
      }

      // 修改：直接返回结果，不进行JSON解析
      return data.result;
    } catch (error) {
      console.error('[assistProblem] Error:', error);
      throw error;
    }
  }
}

// 导出单例
const llmClient = new LLMClient();