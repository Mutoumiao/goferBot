import { Injectable } from '@nestjs/common'
import type { LlmProvider } from './llm-provider.interface.js'
import { OpenAiCompatibleProvider } from './openai-compatible-provider.service.js'

export interface LlmProviderConfig {
  apiKey: string
  model: string
  baseURL?: string
  timeout?: number
  customHeaders?: Record<string, string>
  organization?: string
}

/**
 * LLM Provider 工厂。
 * 当前仅返回 OpenAI-compatible 实现；预留扩展分支用于后续 Claude/Gemini 等 provider。
 */
@Injectable()
export class LlmProviderFactory {
  create(providerKey: string, config: LlmProviderConfig): LlmProvider {
    switch (providerKey) {
      case 'openai-compatible':
      default:
        return new OpenAiCompatibleProvider({
          apiKey: config.apiKey,
          model: config.model,
          baseURL: config.baseURL,
          timeout: config.timeout,
          customHeaders: config.customHeaders,
          organization: config.organization,
        })
    }
  }
}
