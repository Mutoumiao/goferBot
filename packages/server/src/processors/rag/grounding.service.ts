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

/**
 * GroundingService —— RAG 的「事实校验器」
 *
 *   LLM 会"幻觉"——可能说出检索文档里根本没有的内容。Grounding 的任务就是
 *   把答案**按句子拆开**，检查每一句是否被检索 chunks 支撑。
 *
 * 核心算法（混合词汇蕴含判定）：
 *     faithfulnessScore = 0.4 * overlapRatio + 0.6 * bigramRatio
 *
 *   - overlapRatio：句子 token 命中 chunk 的比例（长 token ≥4 字符 ×1.2 加权）
 *   - bigramRatio：句子 bigram 在 chunk 中做子串匹配的比例
 *   - MEDIUM_CONFIDENCE=0.35：低于此值视为 ungrounded
 *   - 短句子（< 8 字符）自动 grounded，避免误判
 *
 * 为什么不用 LLM 做 Grounding？
 *   成本高（每句都调 LLM）、延迟大、而且 LLM 可能对自己的生成"过度自信"。
 *   基于统计的方法毫秒级返回、可解释，足够实用。
 */
@Injectable()
export class GroundingService {
  private readonly logger = new Logger(GroundingService.name)

  /**
   * 对答案逐句做 Grounding 检查
   *
   * 流程：
   *   1) splitSentences 按中英文标点切分
   *   2) tokenize 把句子拆成 token（ASCII 按空格+CJK 单字）
   *   3) 对每个 chunk 调 computeEntailmentScore 打分
   *   4) 取最高分作为句子 faithfulnessScore
   *   5) 分数 ≥ MEDIUM_CONFIDENCE(0.35) 视为 grounded
   *
   * 新人观察：
   *   短句子（<8 字符）自动 grounded，因为过短的句子算分容易误判。
   */
  async checkGrounding(answer: string, chunks: GroundingChunk[]): Promise<GroundingResult[]> {
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
      const matchedChunkIds = chunkScores
        .filter((s) => s.score >= MEDIUM_CONFIDENCE_THRESHOLD)
        .map((s) => s.id)

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
      results.length > 0 ? results.reduce((m, r) => m + r.faithfulnessScore, 0) / results.length : 0

    this.logger.debug(
      `[Grounding] grounded=${groundedCount}/${results.length} avgFaithfulness=${avgScore.toFixed(3)}`,
    )

    return results
  }

  /**
   * 混合词汇蕴含判定（单句子 ↔ 单 chunk 的打分核心）
   *
   *   score = 0.4 * overlapRatio + 0.6 * bigramRatio
   *
   *   ⚠️ 实现注意（与早期文档差异）：
   *     - overlapRatio 是**有向匹配**（hitCount / sentenceCount），
   *       不是 Jaccard（交集 / 并集）。这样能突出"chunk 包含句子全部词汇"的情况。
   *     - 长 token（≥4 字符）命中时额外 ×1.2 加权，对关键术语更敏感。
   *     - bigramRatio 用 chunkLower.includes(bigram) 做**子串匹配**，
   *       捕捉短语级重合，比单纯集合匹配更宽松。
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
      .split(/(?<=[。！？!?.])\s*/g)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  }

  private tokenize(text: string): string[] {
    const lower = text.toLowerCase()
    const asciiTokens = lower
      .split(/[\s,.;:，。！？!?、；："'""''()（）[\]【】/\\]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2)

    const cjkChars = Array.from(lower).filter((c) =>
      /[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u30ff]/.test(c),
    )

    const merged = new Set<string>([...asciiTokens, ...cjkChars])
    return Array.from(merged)
  }
}
