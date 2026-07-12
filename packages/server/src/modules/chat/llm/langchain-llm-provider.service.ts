import { AIMessage, HumanMessage, SystemMessage, type BaseMessage } from '@langchain/core/messages'
import type {
  LlmInvokeOptions,
  LlmMessage,
  LlmProvider,
  LlmStreamChunk,
  LlmStreamOptions,
} from './llm-provider.interface.js'

/** Minimal surface of LangChain chat models used by title gen / optional stream. */
export type LangChainChatModel = {
  invoke: (
    messages: BaseMessage[],
    options?: { signal?: AbortSignal },
  ) => Promise<{ content: unknown }>
  stream: (
    messages: BaseMessage[],
    options?: { signal?: AbortSignal },
  ) => AsyncIterable<{ content: unknown }>
}

/**
 * LlmProvider backed by LangChain (ChatOpenAI / ChatOllama via Provider.toLangChain).
 * Replaces the former LlamaIndex-based implementation for Chat title generation.
 */
export class LangChainLlmProvider implements LlmProvider {
  readonly providerKey = 'langchain'
  readonly capabilities = ['streaming', 'blocking']

  constructor(private readonly model: LangChainChatModel) {}

  async *stream(
    messages: LlmMessage[],
    options?: LlmStreamOptions,
  ): AsyncIterable<LlmStreamChunk> {
    const lcMessages = toLangChainMessages(messages)
    for await (const chunk of this.model.stream(lcMessages, {
      ...(options?.abortSignal ? { signal: options.abortSignal } : {}),
    })) {
      const text = extractText(chunk.content)
      if (text) yield { text }
    }
  }

  async invoke(messages: LlmMessage[], options?: LlmInvokeOptions): Promise<string> {
    void options
    const response = await this.model.invoke(toLangChainMessages(messages))
    return extractText(response.content)
  }
}

function toLangChainMessages(messages: LlmMessage[]): BaseMessage[] {
  return messages.map((m) => {
    if (m.role === 'system') return new SystemMessage(m.content)
    if (m.role === 'assistant') return new AIMessage(m.content)
    return new HumanMessage(m.content)
  })
}

function extractText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((c) => {
        if (typeof c === 'string') return c
        if (c && typeof c === 'object' && 'text' in c) {
          return String((c as { text?: unknown }).text ?? '')
        }
        return ''
      })
      .join('')
  }
  return ''
}
