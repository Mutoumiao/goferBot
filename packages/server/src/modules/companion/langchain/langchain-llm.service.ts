import { ChatOpenAI } from '@langchain/openai'
import { Injectable } from '@nestjs/common'
import { LlmConfigService } from '../config/llm-config.service.js'
import { StructuredOutputService } from './structured-output.service.js'
import type { StreamChunk, StructuredOutputOptions } from './types.js'

@Injectable()
export class LangChainLlmService {
  constructor(
    private readonly llmConfigService: LlmConfigService,
    private readonly structuredOutputService: StructuredOutputService,
  ) {}

  createModel(overrides?: Partial<ConstructorParameters<typeof ChatOpenAI>[0]>): ChatOpenAI {
    return this.llmConfigService.createLangChainChatModel(overrides)
  }

  async *streamChat(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: { abortSignal?: AbortSignal; temperature?: number },
  ): AsyncGenerator<StreamChunk> {
    const model = this.createModel({ temperature: options?.temperature ?? 0.7 })
    const stream = await model.stream(
      messages.map((m) => [m.role, m.content] as const),
      { signal: options?.abortSignal },
    )

    for await (const chunk of stream) {
      if (options?.abortSignal?.aborted) {
        yield { text: '', done: true }
        return
      }
      const text = typeof chunk.content === 'string' ? chunk.content : JSON.stringify(chunk.content)
      if (text) {
        yield { text, done: false }
      }
    }

    yield { text: '', done: true }
  }

  async structuredOutput<T>(
    options: StructuredOutputOptions<T>,
    prompt: string,
    signal?: AbortSignal,
  ): Promise<T> {
    return this.structuredOutputService.invokeWithFallback(options, prompt, signal)
  }

  async invoke(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: { abortSignal?: AbortSignal; temperature?: number },
  ): Promise<string> {
    const model = this.createModel({ temperature: options?.temperature ?? 0.7 })
    const result = await model.invoke(
      messages.map((m) => [m.role, m.content] as const),
      { signal: options?.abortSignal },
    )
    return typeof result.content === 'string' ? result.content : JSON.stringify(result.content)
  }
}
