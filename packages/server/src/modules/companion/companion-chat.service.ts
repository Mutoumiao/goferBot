import { Injectable, Logger } from '@nestjs/common'
import type {
  ChatStreamEvent,
  CompanionErrorCode,
  StreamChatParams,
} from './companion-chat.types.js'
import { CompanionGraphService } from './langgraph/graph.js'
import type { CompanionState, NodeExecutionContext } from './langgraph/interfaces.js'
import { CompanionRepository } from './repositories/companion.repository.js'
import { CompanionConversationRepository } from './repositories/companion-conversation.repository.js'
import { CompanionMemoryRepository } from './repositories/companion-memory.repository.js'
import { CompanionMessageRepository } from './repositories/companion-message.repository.js'

@Injectable()
export class CompanionChatService {
  private readonly logger = new Logger(CompanionChatService.name)

  constructor(
    private readonly graphService: CompanionGraphService,
    private readonly companionRepo: CompanionRepository,
    private readonly conversationRepo: CompanionConversationRepository,
    private readonly messageRepo: CompanionMessageRepository,
    private readonly memoryRepo: CompanionMemoryRepository,
  ) {}

  async *streamChat(params: StreamChatParams): AsyncGenerator<ChatStreamEvent> {
    const stateSnapshots: Array<Partial<CompanionState>> = []
    let safetyBlocked = false
    let safetyReason = ''

    try {
      const companion = await this.companionRepo.findById(params.companionId)
      if (!companion) {
        yield this.errorEvent('ERR_COMPANION_NOT_FOUND', 'Companion not found')
        return
      }

      const conversation = await this.conversationRepo.getOrCreate(
        params.conversationId,
        params.userId,
        params.companionId,
      )

      const [memories, recentMessages, feedbacks] = await Promise.all([
        this.memoryRepo.findByUser(params.userId, params.companionId),
        this.messageRepo.findRecent(conversation.id, 20),
        Promise.resolve([] as Array<{ rating: 'positive' | 'negative'; reason?: string }>),
      ])

      const initialState: Partial<CompanionState> = {
        userId: params.userId,
        companionId: params.companionId,
        conversationId: conversation.id,
        userMessage: params.message,
        existingMemories: memories.map(
          (m: { id: string; type: string; content: string; importance: number }) => ({
            id: m.id,
            type: m.type,
            content: m.content,
            importance: m.importance,
          }),
        ),
        recentMessages: recentMessages.map(
          (m: { id: string; role: string; content: string; createdAt: Date }) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            createdAt: m.createdAt,
          }),
        ),
        feedbacks,
      }

      const signal = params.signal ?? new AbortController().signal
      const ctx: NodeExecutionContext = {
        userId: params.userId,
        companionId: params.companionId,
        conversationId: conversation.id,
        companionName: companion.name,
        companionPersonality: companion.personality ?? undefined,
        companionTone: companion.tone ?? undefined,
        companionBoundaries: companion.boundaries ?? undefined,
        signal,
      }

      let fullState: Partial<CompanionState> = { ...initialState }

      for await (const { node: _node, patch } of this.graphService.stream(
        initialState as CompanionState,
        ctx,
      )) {
        fullState = { ...fullState, ...patch }
        stateSnapshots.push(patch)

        if (
          patch.safety?.boundaryAction === 'refuse' ||
          patch.safety?.boundaryAction === 'crisis_support'
        ) {
          safetyBlocked = true
          safetyReason = patch.safety.reason
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

      this.assertFinalState(fullState)
      const finalState = fullState as CompanionState

      yield {
        event: 'done',
        data: { fullReply: finalState.assistantReply ?? '', quality: finalState.quality },
      }

      if (finalState.summary) {
        yield { event: 'summary', data: { summary: finalState.summary.text } }
      }

      if (finalState.extractedMemories && finalState.extractedMemories.length > 0) {
        const extracted = finalState.extractedMemories
        queueMicrotask(() => this.persistMemories(params, extracted))
        yield { event: 'memories', data: { items: extracted } }
      }

      queueMicrotask(() => this.persistAssistantMessage(conversation.id, finalState))
    } catch (err) {
      const code: CompanionErrorCode =
        (err as { name?: string })?.name === 'AbortError' ? 'ERR_LLM_TIMEOUT' : 'ERR_LLM_PARSE'
      this.logger.error(`streamChat error: ${(err as Error).message}`)
      yield this.errorEvent(code, (err as Error).message)
    }
  }

  private assertFinalState(state: Partial<CompanionState>): asserts state is CompanionState {
    const missing: string[] = []
    const required: Array<keyof CompanionState> = [
      'safety',
      'intent',
      'emotion',
      'route',
      'policy',
      'quality',
      'assistantReply',
    ]
    for (const key of required) {
      if (state[key] === undefined) missing.push(String(key))
    }
    if (missing.length > 0) {
      this.logger.error(`final state integrity violation missing=${missing.join(',')}`)
      throw new Error(`State missing critical fields: ${missing.join(',')}`)
    }
  }

  private async persistMemories(
    params: StreamChatParams,
    items: Array<{ type: string; content: string; importance: number }>,
  ): Promise<void> {
    try {
      const data = items.map((m) => ({
        userId: params.userId,
        companionId: params.companionId,
        type: m.type as
          | 'preference'
          | 'boundary'
          | 'relationship_goal'
          | 'conversation_style'
          | 'important_fact',
        content: m.content,
        importance: m.importance,
        status: 'active' as const,
      }))
      await this.memoryRepo.bulkCreate(data)
    } catch (err) {
      this.logger.error(`persistMemories failed: ${(err as Error).message}`)
    }
  }

  private async persistAssistantMessage(
    conversationId: string,
    state: CompanionState,
  ): Promise<void> {
    try {
      await this.messageRepo.save({
        conversationId,
        role: 'assistant',
        content: state.assistantReply ?? '',
      })
      if (state.summary) {
        await this.conversationRepo.updateSummary(conversationId, state.summary.text)
      }
    } catch (err) {
      this.logger.error(`persistAssistantMessage failed: ${(err as Error).message}`)
    }
  }

  private errorEvent(code: CompanionErrorCode, message: string): ChatStreamEvent {
    return { event: 'error', data: { message, code } }
  }
}
