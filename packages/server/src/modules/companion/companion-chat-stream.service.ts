import { Injectable, Logger } from '@nestjs/common'
import type {
  ChatStreamEvent,
  CompanionErrorCode,
  StreamChatParams,
} from './companion-chat.types.js'
import { CompanionChatPipelineService } from './companion-chat-pipeline.service.js'
import type { CompanionState } from './langgraph/interfaces.js'

@Injectable()
export class CompanionChatStreamService {
  private readonly logger = new Logger(CompanionChatStreamService.name)

  constructor(private readonly pipeline: CompanionChatPipelineService) {}

  async *streamChat(params: StreamChatParams): AsyncGenerator<ChatStreamEvent> {
    try {
      const { companion, conversationId, initialState, ctx } =
        await this.pipeline.prepareContext(params)

      if (!companion) {
        yield this.errorEvent('ERR_COMPANION_NOT_FOUND', 'Companion not found')
        return
      }

      const signal = params.signal ?? new AbortController().signal
      const executionCtx = { ...ctx, signal }

      let fullState: Partial<CompanionState> = { ...initialState }
      let safetyBlocked = false
      let safetyReason = ''

      for await (const {
        patch,
        safetyBlocked: blocked,
        safetyReason: reason,
      } of this.pipeline.execute(initialState as CompanionState, executionCtx)) {
        fullState = { ...fullState, ...patch }

        if (blocked) {
          safetyBlocked = true
          safetyReason = reason
          break
        }

        if (patch.partialTokens) {
          yield { event: 'token', data: { delta: patch.partialTokens } }
        }
      }

      if (safetyBlocked) {
        yield this.errorEvent('ERR_SAFETY_BLOCKED', safetyReason)
        return
      }

      // 图可能因 LLM 配置缺失未跑完节点；完整性失败时仍返回可用文案
      let integrityOk = true
      try {
        this.pipeline.assertFinalState(fullState)
      } catch (integrityErr) {
        integrityOk = false
        this.logger.error(
          `final state incomplete: ${integrityErr instanceof Error ? integrityErr.message : String(integrityErr)}`,
        )
      }

      const partial =
        typeof fullState.partialTokens === 'string' ? fullState.partialTokens.trim() : ''
      const reply =
        (fullState.assistantReply ?? '').trim() ||
        partial ||
        (integrityOk
          ? ''
          : '抱歉，伴侣对话管线暂不可用（可能未配置 Companion LLM）。请在管理后台检查模块配置后重试。')

      if (reply) {
        fullState.assistantReply = reply
      }

      const finalState = fullState as CompanionState

      yield {
        event: 'done',
        data: {
          fullReply: reply,
          content: reply,
          quality: finalState.quality,
        },
      }

      if (finalState.summary) {
        yield { event: 'summary', data: { summary: finalState.summary.text } }
      }

      if (finalState.extractedMemories && finalState.extractedMemories.length > 0) {
        const extracted = finalState.extractedMemories
        queueMicrotask(() =>
          this.pipeline.persistMemories(params.userId, params.companionId, extracted),
        )
        yield { event: 'memories', data: { items: extracted } }
      }

      if (reply) {
        queueMicrotask(() => this.pipeline.persistAssistantMessage(conversationId, finalState))
      }
    } catch (err) {
      const code: CompanionErrorCode =
        (err as { name?: string })?.name === 'AbortError' ? 'ERR_LLM_TIMEOUT' : 'ERR_LLM_PARSE'
      this.logger.error(`streamChat error: ${(err as Error).message}`)
      // 尽量 done + 文案，避免前端只收到 error 又被覆盖成「无内容」
      const fallback =
        (err as Error).message?.includes('State missing')
          ? '抱歉，伴侣对话管线暂不可用（可能未配置 Companion LLM）。请在管理后台检查模块配置后重试。'
          : (err as Error).message || '服务暂时不可用'
      yield {
        event: 'done',
        data: { fullReply: fallback, content: fallback },
      }
      yield this.errorEvent(code, (err as Error).message)
    }
  }

  handleDisconnect(signal: AbortSignal, reason: string): void {
    if (!signal.aborted) {
      signal.addEventListener('abort', () => {
        this.logger.log(`Client disconnected: ${reason}`)
      })
    }
  }

  private errorEvent(code: CompanionErrorCode, message: string): ChatStreamEvent {
    return { event: 'error', data: { message, code } }
  }
}
