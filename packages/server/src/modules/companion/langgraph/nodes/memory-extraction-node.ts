import { agentMemoryExtractionSchema, MEMORY_EXTRACTION_LIMIT } from '@goferbot/data/schemas'
import { Injectable } from '@nestjs/common'
import type { CompanionState, MemoryExtraction, NodeExecutionContext } from '../interfaces.js'
import { agentMemoryExtractionPrompt } from '../prompts.js'
import { SharedNodeFactory } from './_shared.js'

@Injectable()
export class MemoryExtractionNode {
  constructor(private readonly shared: SharedNodeFactory) {}

  async execute(
    state: CompanionState,
    ctx: NodeExecutionContext,
  ): Promise<Partial<CompanionState>> {
    if (!state.memoryCandidate?.shouldExtract) {
      return { extractedMemories: [] }
    }
    const result = await this.shared.invokeStructured<MemoryExtraction>(
      agentMemoryExtractionSchema,
      {
        name: 'memoryExtractionNode',
        prompt: agentMemoryExtractionPrompt,
        buildVariables: async (s, c) => ({
          agentName: c.companionName,
          existingMemories: this.shared.formatMemoriesForPrompt(s.existingMemories),
          memoryCandidate: s.memoryCandidate ? JSON.stringify(s.memoryCandidate) : '（暂无）',
          conversationSummary: s.summary?.text ?? '（暂无）',
          userText: s.userMessage,
          assistantText: s.assistantReply ?? '（暂无）',
        }),
      },
      { memories: [] },
      state,
      ctx,
    )
    const memories = result.memories.slice(0, MEMORY_EXTRACTION_LIMIT)
    return { extractedMemories: memories }
  }
}
