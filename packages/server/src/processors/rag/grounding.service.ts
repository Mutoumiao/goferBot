import { Injectable, Logger } from '@nestjs/common'

export interface GroundingChunk {
  id: string
  content: string
}

export interface GroundingResult {
  sentence: string
  grounded: boolean
  chunkIds: string[]
}

const SHORT_SENTENCE_THRESHOLD = 10
const GROUNDING_THRESHOLD = 0.3

@Injectable()
export class GroundingService {
  private readonly logger = new Logger(GroundingService.name)

  async checkGrounding(
    answer: string,
    chunks: GroundingChunk[],
  ): Promise<GroundingResult[]> {
    if (!answer || !answer.trim()) {
      return []
    }

    const sentences = this.splitSentences(answer)
    const results: GroundingResult[] = []

    for (const sentence of sentences) {
      const trimmed = sentence.trim()
      if (!trimmed) continue

      if (trimmed.length < SHORT_SENTENCE_THRESHOLD) {
        results.push({
          sentence: trimmed,
          grounded: true,
          chunkIds: chunks.map((c) => c.id),
        })
        continue
      }

      const tokens = this.tokenize(trimmed)
      const matchedChunkIds: string[] = []

      for (const chunk of chunks) {
        const chunkText = chunk.content.toLowerCase()
        let hitCount = 0
        for (const token of tokens) {
          if (token.length === 0) continue
          if (chunkText.includes(token)) {
            hitCount += 1
          }
        }
        const ratio = tokens.length > 0 ? hitCount / tokens.length : 0
        if (ratio >= GROUNDING_THRESHOLD) {
          matchedChunkIds.push(chunk.id)
        }
      }

      results.push({
        sentence: trimmed,
        grounded: matchedChunkIds.length > 0,
        chunkIds: matchedChunkIds,
      })
    }

    this.logger.debug(
      `Grounding check: ${results.filter((r) => r.grounded).length}/${results.length} sentences grounded`,
    )

    return results
  }

  private splitSentences(text: string): string[] {
    return text
      .split(/(?<=[。！？!?\.])\s*/g)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  }

  private tokenize(text: string): string[] {
    const lower = text.toLowerCase()
    const asciiTokens = lower
      .split(/[\s,.;:，。！？!?、；："'""''()（）\[\]【】\/\\]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 1)

    const cjkChars = Array.from(lower).filter((c) =>
      /[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u30ff]/.test(c),
    )

    const merged = new Set<string>([...asciiTokens, ...cjkChars])
    return Array.from(merged)
  }
}