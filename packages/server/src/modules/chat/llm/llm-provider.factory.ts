import { Injectable } from '@nestjs/common'
import type { LlamaIndexProviderConfig } from './llama-index-provider.service.js'
import { LlamaIndexProvider } from './llama-index-provider.service.js'
import type { LlmProvider } from './llm-provider.interface.js'

export type LlmProviderConfig = LlamaIndexProviderConfig

/**
 * LLM Provider 工厂。
 * 通过 providerKey 选择实现。当前默认使用 LlamaIndex Provider，支持 openai-compatible 等多种后端。
 */
@Injectable()
export class LlmProviderFactory {
  create(providerKey: string, config: LlmProviderConfig): LlmProvider {
    switch (providerKey) {
      default:
        return new LlamaIndexProvider({
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
