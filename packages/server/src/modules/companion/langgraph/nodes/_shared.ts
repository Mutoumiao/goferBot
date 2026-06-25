import { MEMORY_KEYWORD_REGEX } from '@goferbot/data/schemas'
import type { ChatPromptTemplate } from '@langchain/core/prompts'
import { Injectable, Logger } from '@nestjs/common'
import { LangChainLlmService } from '../../langchain/langchain-llm.service.js'
import { StructuredOutputService } from '../../langchain/structured-output.service.js'
import type { CompanionState, NodeExecutionContext } from '../interfaces.js'

export interface StructuredNodeConfig {
  name: string
  prompt: ChatPromptTemplate
  buildVariables: (
    state: CompanionState,
    ctx: NodeExecutionContext,
  ) => Promise<Record<string, unknown>>
}

@Injectable()
export class SharedNodeFactory {
  private readonly logger = new Logger(SharedNodeFactory.name)

  constructor(
    private readonly structuredOutputService: StructuredOutputService,
    private readonly llmService: LangChainLlmService,
  ) {}

  async invokeStructured<T>(
    schema: unknown,
    config: StructuredNodeConfig,
    fallback: T,
    state: CompanionState,
    ctx: NodeExecutionContext,
  ): Promise<T> {
    const variables = await config.buildVariables(state, ctx)
    const promptValue = await config.prompt.invoke(variables)
    const promptText = typeof promptValue === 'string' ? promptValue : JSON.stringify(promptValue)

    try {
      const result = (await this.structuredOutputService.invokeWithFallback(
        { schema, name: config.name } as never,
        promptText,
        ctx.signal,
      )) as T
      this.logger.debug(`[${config.name}] stage=success`)
      return result
    } catch (err) {
      this.logger.warn(`[${config.name}] stage=fallback error=${(err as Error).message}`)
      return fallback
    }
  }

  async invokeSimplePrompt(
    prompt: string,
    signal?: AbortSignal,
    temperature = 0.3,
  ): Promise<string> {
    return this.llmService.invoke([{ role: 'user', content: prompt }], {
      abortSignal: signal,
      temperature,
    })
  }

  shouldSkipByKeyword(text: string): boolean {
    return MEMORY_KEYWORD_REGEX.test(text)
  }

  formatMemoriesForPrompt(
    memories: Array<{ content: string; importance: number }> | undefined,
  ): string {
    if (!memories || memories.length === 0) return '（暂无）'
    return memories.map((m) => `- [重要度${m.importance}] ${m.content}`).join('\n')
  }

  formatMessagesForPrompt(messages: Array<{ role: string; content: string }> | undefined): string {
    if (!messages || messages.length === 0) return '（暂无）'
    return messages.map((m) => `[${m.role}]: ${m.content}`).join('\n')
  }
}
