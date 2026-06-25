import { agentMemoryCandidateSchema } from '@goferbot/data/schemas'
import { Injectable } from '@nestjs/common'
import type { CompanionState, MemoryCandidate, NodeExecutionContext } from '../interfaces.js'
import { agentMemoryCandidatePrompt } from '../prompts.js'
import { SharedNodeFactory } from './_shared.js'

@Injectable()
export class MemoryCandidateNode {
  constructor(private readonly shared: SharedNodeFactory) {}

  async execute(
    state: CompanionState,
    ctx: NodeExecutionContext,
  ): Promise<Partial<CompanionState>> {
    const hasKeyword = this.shared.shouldSkipByKeyword(state.userMessage)
    const fallbackCandidate: MemoryCandidate = {
      shouldExtract: hasKeyword,
      confidence: hasKeyword ? 0.9 : 0.3,
      category: hasKeyword ? 'preference' : 'unclear',
      stability: hasKeyword ? 'stable' : 'unclear',
      importance: hasKeyword ? 4 : 1,
      reason: hasKeyword ? '关键词命中强制抽取' : 'fallback',
      candidateFacts: [],
    }
    const result = await this.shared.invokeStructured<MemoryCandidate>(
      agentMemoryCandidateSchema,
      {
        name: 'memoryCandidateNode',
        prompt: agentMemoryCandidatePrompt,
        buildVariables: async (s, c) => ({
          agentName: c.companionName,
          existingMemories: this.shared.formatMemoriesForPrompt(s.existingMemories),
          conversationSummary: s.summary?.text ?? '（暂无）',
          userText: s.userMessage,
          assistantText: s.assistantReply ?? '（暂无）',
        }),
      },
      fallbackCandidate,
      state,
      ctx,
    )
    const finalCandidate: MemoryCandidate = hasKeyword
      ? { ...result, shouldExtract: true, confidence: Math.max(result.confidence, 0.9) }
      : result
    return { memoryCandidate: finalCandidate }
  }
}
