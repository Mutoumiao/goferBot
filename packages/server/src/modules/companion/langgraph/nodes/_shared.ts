import { MEMORY_KEYWORD_REGEX } from '@goferbot/data/schemas'
import type { ChatPromptTemplate } from '@langchain/core/prompts'
import { Injectable, Logger } from '@nestjs/common'
import { LangChainLlmService } from '../../langchain/langchain-llm.service.js'
import { StructuredOutputService } from '../../langchain/structured-output.service.js'
import type { CompanionState, MemoryCandidate, NodeExecutionContext } from '../interfaces.js'

/** 对齐参考项目：显式记忆信号（关键词强制倾向抽取） */
const MEMORY_SIGNAL_REGEX =
  /记住|下一次|以后|下次|别再|不要再|我喜欢|我不喜欢|我讨厌|我的习惯|我的边界|我的偏好|我希望你|我以后/i

/** 寒暄/确认短句 */
const SMALL_TALK_ONLY_REGEX =
  /^(嗯|哦|噢|好|好的+|哈哈+|谢谢|谢啦|收到|了解|行|ok|OK|早安|晚安|再见)[。.!！~～\s]*$/i

/** 敏感凭证/隐私（不得入长期记忆） */
const SENSITIVE_MEMORY_REGEX =
  /密码|验证码|身份证|银行卡|住址|手机号|电话|token|api[_\s-]?key|apikey|secret|密钥/i

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
      this.logger.log(`[${config.name}] stage=success`)
      return result
    } catch (_err) {
      this.logger.warn(`[${config.name}] stage=fallback`)
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
    return MEMORY_KEYWORD_REGEX.test(text) || MEMORY_SIGNAL_REGEX.test(text)
  }

  normalizeMemoryContent(content: string): string {
    return content.trim().replace(/\s+/g, ' ').toLowerCase()
  }

  /**
   * 规则快速跳过（对齐 ai-partner-agent shouldSkipMemoryCandidateFast）。
   * 返回候选对象表示跳过 LLM；返回 null 表示进入候选 LLM / 关键词 fallback。
   */
  shouldSkipMemoryCandidateFast(params: {
    userText: string
    assistantText?: string
    existingMemories?: Array<{ content: string }>
  }): MemoryCandidate | null {
    const userText = (params.userText ?? '').trim()
    const assistantText = (params.assistantText ?? '').trim()

    if (!userText) {
      return {
        shouldExtract: false,
        confidence: 0.95,
        category: 'unclear',
        stability: 'unclear',
        importance: 0,
        reason: '用户消息为空，跳过长期记忆候选。',
        candidateFacts: [],
      }
    }

    // 助手尚未生成时（管线顺序上 candidate 在 generate 后，通常有 reply）仍允许继续
    if (
      userText.length < 6 &&
      !MEMORY_SIGNAL_REGEX.test(userText) &&
      !MEMORY_KEYWORD_REGEX.test(userText)
    ) {
      return {
        shouldExtract: false,
        confidence: 0.88,
        category: 'small_talk',
        stability: 'temporary',
        importance: 0,
        reason: '用户消息过短且无明确记忆信号，判定为寒暄或临时内容。',
        candidateFacts: [],
      }
    }

    if (SMALL_TALK_ONLY_REGEX.test(userText)) {
      return {
        shouldExtract: false,
        confidence: 0.92,
        category: 'small_talk',
        stability: 'temporary',
        importance: 0,
        reason: '寒暄、确认或告别类短句，不适合作为长期记忆。',
        candidateFacts: [],
      }
    }

    const normalizedUserText = this.normalizeMemoryContent(userText)
    const existing = params.existingMemories ?? []
    if (existing.some((m) => this.normalizeMemoryContent(m.content) === normalizedUserText)) {
      return {
        shouldExtract: false,
        confidence: 0.9,
        category: 'duplicate',
        stability: 'stable',
        importance: 0,
        reason: '用户消息与已有长期记忆完全重复，无需再次抽取。',
        candidateFacts: [normalizedUserText.slice(0, 120)],
      }
    }

    if (SENSITIVE_MEMORY_REGEX.test(userText)) {
      return {
        shouldExtract: false,
        confidence: 0.96,
        category: 'unsafe',
        stability: 'stable',
        importance: 0,
        reason: '内容疑似包含敏感隐私或凭证信息，不进入长期记忆。',
        candidateFacts: [],
      }
    }

    // assistant 为空不强制跳过（兼容部分测试路径）
    void assistantText
    return null
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
