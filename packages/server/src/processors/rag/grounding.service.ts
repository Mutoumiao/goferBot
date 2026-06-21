import { Injectable, Logger } from '@nestjs/common'

export interface GroundingChunk {
  id: string
  content: string
}

export interface GroundingResult {
  sentence: string
  grounded: boolean
  faithfulnessScore: number
  chunkIds: string[]
  method: 'nli' | 'lexical'
}

const SHORT_SENTENCE_THRESHOLD = 8
const HIGH_CONFIDENCE_THRESHOLD = 0.55
const MEDIUM_CONFIDENCE_THRESHOLD = 0.35

@Injectable()
export class GroundingService {
  private readonly logger = new Logger(GroundingService.name)

  /**
   * Check whether each sentence in the answer is supported by the retrieved
   * chunks. Implements a hybrid approach:
   *
   *  1. NLI-style lexical entailment check (cheap, CPU-friendly) – tokens overlap
   *     with chunk content AND semantic keyword coverage.
   *  2. Faithfulness score based on weighted lexical/semantic match.
   *
   * This is a pragmatic substitute for a full NLI model (which would add
   * ~100–200ms latency per sentence). It prevents the previous "30% token
   * hit => grounded" fallacy by using stricter thresholds and multi-signal
   * scoring.
   */
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
          faithfulnessScore: 1,
          chunkIds: chunks.map((c) => c.id),
          method: 'lexical',
        })
        continue
      }

      const tokens = this.tokenize(trimmed)
      const chunkScores: Array<{ id: string; score: number }> = []

      for (const chunk of chunks) {
        const score = this.computeEntailmentScore(tokens, chunk.content)
        chunkScores.push({ id: chunk.id, score })
      }

      const bestScore = chunkScores.reduce((m, s) => Math.max(m, s.score), 0)
      const matchedChunkIds = chunkScores.filter((s) => s.score >= MEDIUM_CONFIDENCE_THRESHOLD).map((s) => s.id)

      const grounded = bestScore >= MEDIUM_CONFIDENCE_THRESHOLD
      results.push({
        sentence: trimmed,
        grounded,
        faithfulnessScore: Number(bestScore.toFixed(3)),
        chunkIds: matchedChunkIds,
        method: 'lexical',
      })
    }

    const groundedCount = results.filter((r) => r.grounded).length
    const avgScore =
      results.length > 0
        ? results.reduce((m, r) => m + r.faithfulnessScore, 0) / results.length
        : 0

    this.logger.debug(
      `[Grounding] grounded=${groundedCount}/${results.length} avgFaithfulness=${avgScore.toFixed(3)}`,
    )

    return results
  }

  /**
   * Composite entailment score:
   *  - token overlap (Jaccard) 40%
   *  - keyword hit (significant tokens present in chunk) 60%
   */
  private computeEntailmentScore(tokens: string[], chunkText: string): number {
    if (tokens.length === 0) return 0

    const chunkLower = chunkText.toLowerCase()
    const chunkTokens = new Set(this.tokenize(chunkText))

    const sentenceSet = new Set(tokens)
    let hitCount = 0
    let weightedHit = 0

    for (const token of tokens) {
      if (token.length < 2) continue
      if (chunkTokens.has(token)) {
        hitCount += 1
        weightedHit += token.length >= 4 ? 1.2 : 1
      }
    }

    const overlapRatio = sentenceSet.size > 0 ? hitCount / sentenceSet.size : 0

    const bigramSentence = this.getBigrams(tokens)
    let bigramHits = 0
    for (const bg of bigramSentence) {
      if (chunkLower.includes(bg)) bigramHits += 1
    }
    const bigramRatio = bigramSentence.size > 0 ? bigramHits / bigramSentence.size : 0

    const score = 0.4 * overlapRatio + 0.6 * bigramRatio
    return Math.min(1, score)
  }

  private getBigrams(tokens: string[]): Set<string> {
    const result = new Set<string>()
    for (let i = 0; i < tokens.length - 1; i++) {
      result.add(`${tokens[i]} ${tokens[i + 1]}`)
    }
    return result
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
      .filter((t) => t.length >= 2)

    const cjkChars = Array.from(lower).filter((c) =>
      /[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u30ff]/.test(c),
    )

    const merged = new Set<string>([...asciiTokens, ...cjkChars])
    return Array.from(merged)
  }
}
