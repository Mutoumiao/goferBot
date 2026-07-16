import { Injectable, Logger } from '@nestjs/common'
import type {
  ChatStreamEvent,
  CompanionErrorCode,
  StreamChatParams,
} from './companion-chat.types.js'
import { CompanionChatPipelineService } from './companion-chat-pipeline.service.js'
import type { CompanionState } from './langgraph/interfaces.js'
import { CompanionObsEventRepository } from './repositories/companion-obs-event.repository.js'

@Injectable()
export class CompanionChatStreamService {
  private readonly logger = new Logger(CompanionChatStreamService.name)

  constructor(
    private readonly pipeline: CompanionChatPipelineService,
    private readonly obsEvents: CompanionObsEventRepository,
  ) {}

  async *streamChat(params: StreamChatParams): AsyncGenerator<ChatStreamEvent> {
    const startedAt = Date.now()
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
        // 设计 A：不落助手消息；A1+ 侧信道写 obs_event 供看板聚合
        await this.obsEvents.recordSafetyHardStop({
          companionId: params.companionId,
          conversationId,
          userId: params.userId,
          boundaryAction: fullState.safety?.boundaryAction,
          reason: safetyReason,
        })
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
      const latencyMs = Date.now() - startedAt

      // 先落库再 done：客户端收到完成时历史已可读；亦避免连发时 findRecent 缺上轮助手
      if (reply) {
        await this.pipeline.persistAssistantMessage(conversationId, finalState, { latencyMs })
      }

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
    } catch (err) {
      const message = (err as Error).message || '服务暂时不可用'
      if (message === 'ERR_COMPANION_NOT_FOUND') {
        yield this.errorEvent('ERR_COMPANION_NOT_FOUND', 'Companion not found')
        return
      }
      if (message === 'ERR_COMPANION_ARCHIVED') {
        // 门闸在用户落库前，会话保持干净
        yield this.errorEvent('ERR_COMPANION_ARCHIVED', '该伴侣已归档，无法发送新消息')
        return
      }
      const code: CompanionErrorCode =
        (err as { name?: string })?.name === 'AbortError' ? 'ERR_LLM_TIMEOUT' : 'ERR_LLM_PARSE'
      this.logger.error(`streamChat error: ${message}`)
      // 设计 A：若 prepareContext 已成功，user 已落库；此处 done 仅给客户端即时文案，不伪造成功助手消息
      const fallback = message.includes('State missing')
        ? '抱歉，伴侣对话管线暂不可用（可能未配置 Companion LLM）。请在管理后台检查模块配置后重试。'
        : message
      yield {
        event: 'done',
        data: { fullReply: fallback, content: fallback, quality: undefined },
      }
      yield this.errorEvent(code, message)
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
