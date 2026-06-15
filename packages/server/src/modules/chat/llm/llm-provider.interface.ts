export interface LlmMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LlmStreamOptions {
  abortSignal?: AbortSignal
  temperature?: number
}

export interface LlmInvokeOptions {
  temperature?: number
}

export interface LlmStreamChunk {
  text: string
}

/**
 * LLM Provider 抽象接口。
 * 当前仅实现 OpenAI-compatible；预留 providerKey / capabilities 供后续扩展。
 */
export interface LlmProvider {
  readonly providerKey: string
  readonly capabilities: string[]

  stream(messages: LlmMessage[], options?: LlmStreamOptions): AsyncIterable<LlmStreamChunk>
  invoke(messages: LlmMessage[], options?: LlmInvokeOptions): Promise<string>
}
