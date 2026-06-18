import type { BaseMessage } from '@langchain/core/messages'
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages'
import { ChatOpenAI } from '@langchain/openai'
import { Injectable } from '@nestjs/common'
import type {
  LlmInvokeOptions,
  LlmMessage,
  LlmProvider,
  LlmStreamChunk,
  LlmStreamOptions,
} from './llm-provider.interface.js'

export interface OpenAiCompatibleProviderConfig {
  apiKey: string
  model: string
  baseURL?: string
  timeout?: number
  customHeaders?: Record<string, string>
  organization?: string
}

@Injectable()
export class OpenAiCompatibleProvider implements LlmProvider {
  readonly providerKey = 'openai-compatible'
  readonly capabilities = ['streaming', 'blocking']

  private readonly client: ChatOpenAI

  constructor(readonly config: OpenAiCompatibleProviderConfig) {
    this.client = new ChatOpenAI({
      apiKey: config.apiKey,
      model: config.model,
      streaming: true,
      timeout: config.timeout ?? 300_000,
      configuration: {
        baseURL: config.baseURL,
        defaultHeaders: config.customHeaders,
        organization: config.organization,
      },
    })
  }

  async *stream(messages: LlmMessage[], options?: LlmStreamOptions): AsyncIterable<LlmStreamChunk> {
    const lcMessages = messages.map((m) => this.toLangChainMessage(m))
    const stream = await this.client.stream(lcMessages, {
      signal: options?.abortSignal,
    })

    for await (const chunk of stream) {
      const text = this.extractText(chunk.content)
      if (text) {
        yield { text }
      }
    }
  }

  async invoke(messages: LlmMessage[], _options?: LlmInvokeOptions): Promise<string> {
    const lcMessages = messages.map((m) => this.toLangChainMessage(m))
    const response = await this.client.invoke(lcMessages)
    return this.extractText(response.content)
  }

  private toLangChainMessage(message: LlmMessage): BaseMessage {
    switch (message.role) {
      case 'system':
        return new SystemMessage(message.content)
      case 'assistant':
        return new AIMessage(message.content)
      default:
        return new HumanMessage(message.content)
    }
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
}
