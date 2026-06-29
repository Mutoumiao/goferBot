import { Injectable, Logger } from '@nestjs/common'
import { CompanionGraphService } from './langgraph/graph.js'
import type { CompanionState, NodeExecutionContext } from './langgraph/interfaces.js'
import { CompanionRepository } from './repositories/companion.repository.js'
import { CompanionConversationRepository } from './repositories/companion-conversation.repository.js'
import { CompanionMemoryRepository } from './repositories/companion-memory.repository.js'
import { CompanionMessageRepository } from './repositories/companion-message.repository.js'

@Injectable()
export class CompanionChatPipelineService {
  private readonly logger = new Logger(CompanionChatPipelineService.name)

  constructor(
    private readonly graphService: CompanionGraphService,
    private readonly companionRepo: CompanionRepository,
    private readonly conversationRepo: CompanionConversationRepository,
    private readonly messageRepo: CompanionMessageRepository,
    private readonly memoryRepo: CompanionMemoryRepository,
  ) {}

  async prepareContext(params: {
    userId: string
    companionId: string
    conversationId?: string
    message: string
  }): Promise<{
    companion: Awaited<ReturnType<CompanionRepository['findById']>>
    conversationId: string
    initialState: Partial<CompanionState>
    ctx: NodeExecutionContext
  }> {
    const companion = await this.companionRepo.findByIdAndAuthorize(
      params.companionId,
      params.userId,
    )
    if (!companion) {
      throw new Error('ERR_COMPANION_NOT_FOUND')
    }

    const conversation = await this.conversationRepo.getOrCreate(
      params.conversationId,
      params.userId,
      params.companionId,
    )
    const [memories, recentMessages] = await Promise.all([
      this.memoryRepo.findByUser(params.userId, params.companionId),
      this.messageRepo.findRecent(conversation.id, 20),
    ])

    const initialState: Partial<CompanionState> = {
      userId: params.userId,
      companionId: params.companionId,
      conversationId: conversation.id,
      userMessage: params.message,
      existingMemories: memories.map((m) => ({
        id: m.id,
        type: m.type,
        content: m.content,
        importance: m.importance,
      })),
      recentMessages: recentMessages.map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        createdAt: m.createdAt,
      })),
      feedbacks: [],
    }

    const ctx: NodeExecutionContext = {
      userId: params.userId,
      companionId: params.companionId,
      conversationId: conversation.id,
      companionName: companion.name,
      companionPersonality: companion.personality ?? undefined,
      companionTone: companion.tone ?? undefined,
      companionBoundaries: companion.boundaries ?? undefined,
      signal: new AbortController().signal,
    }

    return { companion, conversationId: conversation.id, initialState, ctx }
  }

  async *execute(
    initialState: CompanionState,
    ctx: NodeExecutionContext,
  ): AsyncGenerator<{
    patch: Partial<CompanionState>
    safetyBlocked: boolean
    safetyReason: string
  }> {
    let safetyBlocked = false
    let safetyReason = ''

    for await (const { patch } of this.graphService.stream(initialState, ctx)) {
      if (
        patch.safety?.boundaryAction === 'refuse' ||
        patch.safety?.boundaryAction === 'crisis_support'
      ) {
        safetyBlocked = true
        safetyReason = patch.safety.reason
        yield { patch, safetyBlocked: true, safetyReason }
        break
      }

      yield { patch, safetyBlocked: false, safetyReason: '' }
    }
  }

  assertFinalState(state: Partial<CompanionState>): asserts state is CompanionState {
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

  async persistMemories(
    userId: string,
    companionId: string,
    items: Array<{ type: string; content: string; importance: number }>,
  ): Promise<void> {
    try {
      const data = items.map((m) => ({
        userId,
        companionId,
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

  async persistAssistantMessage(conversationId: string, state: CompanionState): Promise<void> {
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
}
