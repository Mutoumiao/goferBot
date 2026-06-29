import { Injectable, Logger } from '@nestjs/common'
import type { RetrievedChunk } from './rag-types.js'

const DEFAULT_CONTEXT_TOKEN_BUDGET = 3000

@Injectable()
export class RagContextService {
  private readonly logger = new Logger(RagContextService.name)

  async buildContext(
    chunks: RetrievedChunk[],
    tokenBudget: number = DEFAULT_CONTEXT_TOKEN_BUDGET,
  ): Promise<string> {
    if (chunks.length === 0) return ''

    const deduped = this.deduplicateByDocument(chunks)

    const ordered = [...deduped].sort((a, b) => b.score - a.score)

    const selected: RetrievedChunk[] = []
    let usedTokens = 0

    for (const chunk of ordered) {
      const estimatedTokens = Math.max(1, Math.ceil(chunk.content.length / 2))
      if (usedTokens + estimatedTokens > tokenBudget) {
        const remaining = tokenBudget - usedTokens
        if (remaining <= 0) break
        const ratio = remaining / estimatedTokens
        const truncated = chunk.content.slice(0, Math.floor(chunk.content.length * ratio))
        if (truncated.trim().length > 0) {
          selected.push({ ...chunk, content: `${truncated.trim()}...` })
        }
        break
      }
      selected.push(chunk)
      usedTokens += estimatedTokens
    }

    this.logger.log(
      `[ContextBuilder] chunks=${chunks.length} deduped=${deduped.length} selected=${selected.length} tokens=${usedTokens} budget=${tokenBudget}`,
    )

    return selected.map((c, i) => `[${i + 1}] ${c.content}`).join('\n\n')
  }

  private deduplicateByDocument(chunks: RetrievedChunk[]): RetrievedChunk[] {
    const seenDocumentIds = new Set<string>()
    const result: RetrievedChunk[] = []
    for (const chunk of chunks) {
      if (!seenDocumentIds.has(chunk.documentId)) {
        seenDocumentIds.add(chunk.documentId)
        result.push(chunk)
      }
    }
    return result
  }
}
