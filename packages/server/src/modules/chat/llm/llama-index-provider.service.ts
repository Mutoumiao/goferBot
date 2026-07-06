import { OpenAI } from '@llamaindex/openai'
import { Injectable } from '@nestjs/common'
import type {
  LlmInvokeOptions,
  LlmMessage,
  LlmProvider,
  LlmStreamChunk,
  LlmStreamOptions,
} from './llm-provider.interface.js'

export interface LlamaIndexProviderConfig {
  apiKey: string
  model: string
  baseURL?: string
  timeout?: number
  customHeaders?: Record<string, string>
  organization?: string
}

/**
 * 根据 isCompleteUrl 解析 LLM baseURL。
 * - false（默认）：baseUrl 是 API 网关地址，SDK 自动拼 /chat/completions
 * - true：baseUrl 是完整请求地址，strip /chat/completions 后缀供 SDK 重新拼接
 */
export function resolveLlmBaseURL(
  baseUrl: string | undefined,
  isCompleteUrl: boolean,
): string | undefined {
  if (!baseUrl) return undefined
  if (!isCompleteUrl) return baseUrl
  // ponytail: strip 已知端点后缀，SDK 会重新拼接
  return baseUrl.replace(/\/chat\/completions$/, '')
}

@Injectable()
export class LlamaIndexProvider implements LlmProvider {
  readonly providerKey = 'llama-index'
  readonly capabilities = ['streaming', 'blocking']

  private readonly client: OpenAI

  constructor(readonly config: LlamaIndexProviderConfig) {
    this.client = new OpenAI({
      model: config.model,
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: config.timeout,
      additionalSessionOptions: {
        defaultHeaders: config.customHeaders,
        organization: config.organization,
      },
    })
  }

  async *stream(messages: LlmMessage[], options?: LlmStreamOptions): AsyncIterable<LlmStreamChunk> {
    const response = await this.client.chat({
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
      // M7: 传递 temperature 和 signal 到 LLM 调用
      ...(options?.temperature !== undefined && { temperature: options.temperature }),
      ...(options?.abortSignal && { signal: options.abortSignal }),
    })

    if (!this.isAsyncIterable(response)) return

    for await (const chunk of response) {
      const text = chunk.delta
      if (text) {
        yield { text }
      }
    }
  }

  async invoke(messages: LlmMessage[], options?: LlmInvokeOptions): Promise<string> {
    const response = await this.client.chat({
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      // M7: 传递 temperature 到 LLM 调用
      ...(options?.temperature !== undefined && { temperature: options.temperature }),
    })

    return this.extractText(response.message.content)
  }

  private extractText(content: unknown): string {
    if (typeof content === 'string') return content
    if (Array.isArray(content)) {
      return content
        .map((c) => (typeof c === 'string' ? c : ((c as { text?: string }).text ?? '')))
        .join('')
    }
    return ''
  }

  private isAsyncIterable(value: unknown): value is AsyncIterable<{ delta: string }> {
    return (
      typeof (value as { [Symbol.asyncIterator]?: unknown })?.[Symbol.asyncIterator] === 'function'
    )
  }
}
