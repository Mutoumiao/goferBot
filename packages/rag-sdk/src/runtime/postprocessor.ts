import type { IReranker } from '../interfaces.js'
import type { Query, RetrievalCandidate } from '../types.js'
import type { SelectionTrace } from './selection-trace.js'

export interface DefaultRetrievalPostprocessorOptions {
  minScore?: number
  maxChunks?: number
  tokenBudget?: number
  reranker?: IReranker
}

export class DefaultRetrievalPostprocessor {
  private minScore: number
  private maxChunks: number
  private tokenBudget: number
  private reranker?: IReranker

  constructor(options: DefaultRetrievalPostprocessorOptions = {}) {
    this.minScore = options.minScore ?? 0.0
    this.maxChunks = options.maxChunks ?? 10
    this.tokenBudget = options.tokenBudget ?? 3000
    this.reranker = options.reranker
  }

  async process(
    candidates: RetrievalCandidate[],
    query: Query,
  ): Promise<{ candidates: RetrievalCandidate[]; trace: SelectionTrace }> {
    const trace: SelectionTrace = {
      initialCount: candidates.length,
      afterFilter: candidates.length,
      afterRerank: candidates.length,
      afterBudgetTrim: candidates.length,
      afterMaxChunksTrim: candidates.length,
      finalCount: candidates.length,
      steps: [],
    }

    let result = candidates

    // 1. Score filter
    const beforeFilter = result.length
    result = result.filter((c) => c.score >= this.minScore)
    trace.afterFilter = result.length
    if (result.length < beforeFilter) {
      trace.steps.push({
        operation: 'filter',
        reason: `minScore=${this.minScore}`,
        droppedCount: beforeFilter - result.length,
      })
    }

    // 2. Rerank
    if (this.reranker) {
      const beforeRerank = result.length
      result = await this.reranker.rerank(result, query)
      trace.afterRerank = result.length
      trace.steps.push({
        operation: 'rerank',
        reason: 'reranker applied',
        droppedCount: beforeRerank - result.length,
      })
    }

    // 3. Budget trim
    const beforeBudget = result.length
    let tokenSum = 0
    result = result.filter((c) => {
      const tokens = c.chunk.tokenCount ?? Math.ceil(c.chunk.content.length / 4)
      if (tokenSum + tokens > this.tokenBudget) return false
      tokenSum += tokens
      return true
    })
    trace.afterBudgetTrim = result.length
    if (result.length < beforeBudget) {
      trace.steps.push({
        operation: 'budget-trim',
        reason: `tokenBudget=${this.tokenBudget}`,
        droppedCount: beforeBudget - result.length,
      })
    }

    // 4. Max chunks trim
    const beforeMax = result.length
    if (result.length > this.maxChunks) {
      result = result.slice(0, this.maxChunks)
    }
    trace.afterMaxChunksTrim = result.length
    if (result.length < beforeMax) {
      trace.steps.push({
        operation: 'max-chunks-trim',
        reason: `maxChunks=${this.maxChunks}`,
        droppedCount: beforeMax - result.length,
      })
    }

    trace.finalCount = result.length
    return { candidates: result, trace }
  }
}
