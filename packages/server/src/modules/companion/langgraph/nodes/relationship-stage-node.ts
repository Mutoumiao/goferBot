import {
  conversationRelationshipStageSchema,
  fallbackRelationshipStage,
} from '@goferbot/data/schemas'
import { Injectable } from '@nestjs/common'
import type { CompanionState, NodeExecutionContext, RelationshipResult } from '../interfaces.js'
import { conversationRelationshipStagePrompt } from '../prompts.js'
import { SharedNodeFactory } from './_shared.js'

@Injectable()
export class RelationshipStageNode {
  constructor(private readonly shared: SharedNodeFactory) {}

  async execute(
    state: CompanionState,
    ctx: NodeExecutionContext,
  ): Promise<Partial<CompanionState>> {
    const messageCount = state.recentMessages?.length ?? 0
    const result = await this.shared.invokeStructured<RelationshipResult>(
      conversationRelationshipStageSchema,
      {
        name: 'relationshipStageNode',
        prompt: conversationRelationshipStagePrompt,
        buildVariables: async (s, c) => ({
          agentName: c.companionName,
          agentGuardrails: c.companionGuardrails ?? '',
          messageCount,
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
