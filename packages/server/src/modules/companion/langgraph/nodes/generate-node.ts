import { Injectable, Logger } from '@nestjs/common'
import { LangChainLlmService } from '../../langchain/langchain-llm.service.js'
import type { CompanionState, NodeExecutionContext } from '../interfaces.js'
import { SharedNodeFactory } from './_shared.js'

const _MAX_SENTENCES = 4
const _MAX_QUESTIONS = 2
const _MAX_SUGGESTIONS = 1

@Injectable()
export class GenerateNode {
  private readonly logger = new Logger(GenerateNode.name)

  constructor(
    private readonly llmService: LangChainLlmService,
    private readonly shared: SharedNodeFactory,
  ) {}

  async execute(
    state: CompanionState,
    ctx: NodeExecutionContext,
  ): Promise<Partial<CompanionState>> {
    const systemPrompt = this.assembleFinalPrompt(state, ctx)

    try {
      const chunks: string[] = []
      for await (const chunk of this.llmService.streamChat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: state.userMessage },
        ],
        { abortSignal: ctx.signal, temperature: 0.85 },
      )) {
        chunks.push(chunk.text)
      }
      const reply = chunks.join('').trim()
      this.logger.log(`[generateNode] stage=success length=${reply.length}`)
      return { assistantReply: reply, partialTokens: reply }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        this.logger.warn('[generateNode] stage=aborted')
      } else {
        this.logger.error(`[generateNode] stage=error code=GENERATE_ERROR`)
      }
      const fallback = this.buildFallbackReply(state)
      return { assistantReply: fallback, lastFallback: 'generate-error' }
    }
  }

  private assembleFinalPrompt(state: CompanionState, ctx: NodeExecutionContext): string {
    const parts: string[] = []

    parts.push('# 1. 人设')
    if (ctx.companionDefaultPrompt?.trim()) {
      // 权威：入库的多节 defaultPrompt 必须进入 generate 注入链
      parts.push(ctx.companionDefaultPrompt.trim())
    } else {
      parts.push(`你是 ${ctx.companionName}。`)
      if (ctx.companionPersonality) parts.push(`性格/人设：${ctx.companionPersonality}`)
      if (ctx.companionTone) parts.push(`说话语气：${ctx.companionTone}`)
      if (ctx.companionBoundaries) parts.push(`边界提醒：${ctx.companionBoundaries}`)
    }

    parts.push('')
    parts.push('# 2. 长期记忆（用户明确透露、未来稳定有用的信息）')
    parts.push(this.shared.formatMemoriesForPrompt(state.existingMemories))

    parts.push('')
    parts.push('# 3. 最近对话')
    parts.push(this.shared.formatMessagesForPrompt(state.recentMessages))

    parts.push('')
    parts.push('# 4. 本轮安全边界')
    if (state.safety) {
      parts.push(`安全等级: ${state.safety.safetyLevel}`)
      parts.push(`边界动作: ${state.safety.boundaryAction}`)
      parts.push(`回复指南: ${state.safety.responseGuidance}`)
    } else {
      parts.push('（暂无）')
    }

    parts.push('')
    parts.push('# 5. 意图 / 情绪 / 关系判断')
    if (state.intent) {
      parts.push(`意图: ${state.intent.primary} (需: ${state.intent.userNeed})`)
      parts.push(`意图指南: ${state.intent.promptGuidance}`)
    }
    if (state.emotion) {
      parts.push(
        `情绪: ${state.emotion.primaryEmotion} (强度: ${state.emotion.intensity}, 基调: ${state.emotion.replyTone})`,
      )
    }
    if (state.relationship) {
      parts.push(
        `关系阶段: ${state.relationship.stage} (亲密度: ${state.relationship.intimacyPermission})`,
      )
      parts.push(`关系指南: ${state.relationship.relationshipGuidance}`)
    }

    parts.push('')
    parts.push('# 6. 策略路由')
    if (state.route) {
      parts.push(`路由: ${state.route.route}`)
      parts.push(`响应长度: ${state.route.responseLength}`)
      parts.push(`路由指南: ${state.route.routeGuidance}`)
    } else {
      parts.push('（暂无）')
    }

    parts.push('')
    parts.push('# 7. 回复策略包')
    if (state.policy) {
      parts.push(`策略: ${state.policy.policy}`)
      parts.push(`开场动作: ${state.policy.openingMove}`)
      parts.push(
        `句子预算: ${state.policy.sentenceBudget.min}-${state.policy.sentenceBudget.max} 句`,
      )
      parts.push(`允许动作: ${state.policy.allowedMoves.join(', ')}`)
      parts.push(`禁止动作: ${state.policy.forbiddenMoves.join(', ')}`)
      parts.push(`风格指南: ${state.policy.styleGuidance}`)
    } else {
      parts.push('（暂无）')
    }

    parts.push('')
    parts.push('# 8. 历史反馈')
    if (state.feedbacks && state.feedbacks.length > 0) {
      for (const f of state.feedbacks) {
        parts.push(`- ${f.rating} ${f.reason ?? ''}`)
      }
    } else {
      parts.push('（暂无）')
    }

    return parts.join('\n')
  }

  private buildFallbackReply(state: CompanionState): string {
    const policy = state.policy
    const route = state.route?.route

    if (route === 'quiet_presence') {
      return '我在这儿。'
    }
    if (route === 'deep_comfort') {
      return '我在听。你不用急着说，我陪你慢慢说。'
    }
    if (route === 'gentle_clarification') {
      return '嗯嗯，我听到了。你这会儿最想先聊哪一部分呀？'
    }
    if (policy?.openingMove === 'apologize') {
      return '刚才是我没接好，对不起。你愿意再跟我说说吗？'
    }
    return '嗯嗯，我在听。你可以慢慢说。'
  }
}
