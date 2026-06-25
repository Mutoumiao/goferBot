import { conversationEmotionSchema, fallbackEmotion } from '@goferbot/data/schemas'
import { Injectable } from '@nestjs/common'
import type { CompanionState, EmotionResult, NodeExecutionContext } from '../interfaces.js'
import { conversationEmotionPrompt } from '../prompts.js'
import { SharedNodeFactory } from './_shared.js'

@Injectable()
export class EmotionNode {
  constructor(private readonly shared: SharedNodeFactory) {}

  async execute(
    state: CompanionState,
    ctx: NodeExecutionContext,
  ): Promise<Partial<CompanionState>> {
    const result = await this.shared.invokeStructured<EmotionResult>(
      conversationEmotionSchema,
      {
        name: 'emotionNode',
        prompt: conversationEmotionPrompt,
        buildVariables: async (s, c) => ({
          agentName: c.companionName,
          agentGuardrails: c.companionGuardrails ?? '',
          safety: s.safety ? JSON.stringify(s.safety) : '（暂无）',
          intent: s.intent ? JSON.stringify(s.intent) : '（暂无）',
          activeMemories: this.shared.formatMemoriesForPrompt(s.existingMemories),
          recentMessages: this.shared.formatMessagesForPrompt(s.recentMessages),
          userText: s.userMessage,
        }),
      },
      fallbackEmotion,
      state,
      ctx,
    )
    return { emotion: result }
  }
}
