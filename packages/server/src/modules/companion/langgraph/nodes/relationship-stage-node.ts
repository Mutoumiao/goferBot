import {
  conversationRelationshipStageSchema,
  fallbackRelationshipStage,
} from '@goferbot/data/schemas'
import { Injectable } from '@nestjs/common'
import type { CompanionState, NodeExecutionContext, RelationshipResult } from '../interfaces.js'
import { conversationRelationshipStagePrompt } from '../prompts.js'
import { SharedNodeFactory } from './_shared.js'

/** 关系阶段注入用的消息计数：优先会话累计，禁止误用 recent 窗口长度。 */
export function resolveRelationshipMessageCount(
  state: Pick<CompanionState, 'messageCount' | 'recentMessages'>,
): number {
  if (typeof state.messageCount === 'number' && Number.isFinite(state.messageCount)) {
    return Math.max(0, Math.floor(state.messageCount))
  }
  // 兼容未注入 messageCount 的旧调用；仅作降级，语义不完整
  return state.recentMessages?.length ?? 0
}

@Injectable()
export class RelationshipStageNode {
  constructor(private readonly shared: SharedNodeFactory) {}

  async execute(
    state: CompanionState,
    ctx: NodeExecutionContext,
  ): Promise<Partial<CompanionState>> {
    // 必须用会话累计 messageCount；recent 窗口 ≤ RECENT_MESSAGE_LIMIT，且不含本轮 userMessage
    const result = await this.shared.invokeStructured<RelationshipResult>(
      conversationRelationshipStageSchema,
      {
        name: 'relationshipStageNode',
        prompt: conversationRelationshipStagePrompt,
        buildVariables: async (s, c) => ({
          agentName: c.companionName,
          agentGuardrails: c.companionGuardrails ?? '',
          messageCount: resolveRelationshipMessageCount(s),
          conversationSummary: s.summary?.text ?? '（暂无）',
          safety: s.safety ? JSON.stringify(s.safety) : '（暂无）',
          intent: s.intent ? JSON.stringify(s.intent) : '（暂无）',
          emotion: s.emotion ? JSON.stringify(s.emotion) : '（暂无）',
          activeMemories: this.shared.formatMemoriesForPrompt(s.existingMemories),
          recentMessages: this.shared.formatMessagesForPrompt(s.recentMessages),
          userText: s.userMessage,
        }),
      },
      fallbackRelationshipStage,
      state,
      ctx,
    )
    return { relationship: result }
  }
}
