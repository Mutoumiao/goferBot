import { conversationIntentSchema, fallbackIntent } from '@goferbot/data/schemas'
import { Injectable } from '@nestjs/common'
import type { CompanionState, IntentResult, NodeExecutionContext } from '../interfaces.js'
import { conversationIntentPrompt } from '../prompts.js'
import { SharedNodeFactory } from './_shared.js'

@Injectable()
export class IntentNode {
  constructor(private readonly shared: SharedNodeFactory) {}

  async execute(
    state: CompanionState,
    ctx: NodeExecutionContext,
  ): Promise<Partial<CompanionState>> {
    const result = await this.shared.invokeStructured<IntentResult>(
      conversationIntentSchema,
      {
        name: 'intentNode',
        prompt: conversationIntentPrompt,
        buildVariables: async (s, c) => ({
          agentName: c.companionName,
          agentGuardrails: c.companionGuardrails ?? '',
          safety: s.safety ? JSON.stringify(s.safety) : '（暂无）',
          activeMemories: this.shared.formatMemoriesForPrompt(s.existingMemories),
          recentMessages: this.shared.formatMessagesForPrompt(s.recentMessages),
          userText: s.userMessage,
        }),
      },
      fallbackIntent,
      state,
      ctx,
    )
    return { intent: result }
  }
}
