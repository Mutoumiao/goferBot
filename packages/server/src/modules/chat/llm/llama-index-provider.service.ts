import { OpenAI } from '@llamaindex/openai'
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
 * 已废弃：Provider 类体系接管了 baseURL 解析。保留供 RAG 兼容。
 */
export function resolveLlmBaseURL(
  baseUrl: string | undefined,
  isCompleteUrl: boolean,
): string | undefined {
  if (!baseUrl) return undefined
  if (!isCompleteUrl) return baseUrl
  return baseUrl.replace(/\/chat\/completions$/, '')
}

type ChatClient = Pick<OpenAI, 'chat'>

export class LlamaIndexProvider implements LlmProvider {
  readonly providerKey = 'llama-index'
  readonly capabilities = ['streaming', 'blocking']

  private readonly client: ChatClient

  /**
   * 支持两种构造方式：
   * - 传入 pre-created client（ProviderRegistry 方式）
   * - 传入 config（兼容旧代码）
   */
  constructor(clientOrConfig: ChatClient | LlamaIndexProviderConfig) {
    if (this.isClient(clientOrConfig)) {
      this.client = clientOrConfig
    } else {
      const config = clientOrConfig
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
  }

  async *stream(messages: LlmMessage[], options?: LlmStreamOptions): AsyncIterable<LlmStreamChunk> {
    const response = await this.client.chat({
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
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

  private isClient(value: unknown): value is ChatClient {
    if (value instanceof OpenAI) return true
    // 支持测试 mock 对象（带 _providerReady 标记）
    if (typeof value === 'object' && value !== null && '_providerReady' in value) return true
    return false
  }
}
