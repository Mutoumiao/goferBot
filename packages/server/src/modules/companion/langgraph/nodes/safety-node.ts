import { conversationSafetySchema, fallbackSafety } from '@goferbot/data/schemas'
import { Injectable } from '@nestjs/common'
import type { CompanionState, NodeExecutionContext, SafetyResult } from '../interfaces.js'
import { conversationSafetyPrompt } from '../prompts.js'
import { SharedNodeFactory } from './_shared.js'

@Injectable()
export class SafetyNode {
  constructor(private readonly shared: SharedNodeFactory) {}

  async execute(
    state: CompanionState,
    ctx: NodeExecutionContext,
  ): Promise<Partial<CompanionState>> {
    const result = await this.shared.invokeStructured<SafetyResult>(
      conversationSafetySchema,
      {
        name: 'safetyNode',
        prompt: conversationSafetyPrompt,
        buildVariables: async (s, c) => ({
          agentName: c.companionName,
          agentGuardrails: c.companionGuardrails ?? '',
          activeMemories: this.shared.formatMemoriesForPrompt(s.existingMemories),
          recentMessages: this.shared.formatMessagesForPrompt(s.recentMessages),
          userText: s.userMessage,
        }),
      },
      fallbackSafety,
      state,
      ctx,
    )
    return { safety: result }
  }
}
