import { RetrievalError } from '../errors.js'
import type { IEmbedder, IKeywordStore, IRetriever } from '../interfaces.js'
import type { HybridSearchOptions, Query, RetrievalCandidate } from '../types.js'
import type { IVectorStore } from '../vector-store.js'
import { reciprocalRankFusion } from './rrf.js'

export interface HybridRetrieverOptions {
  vectorStore: IVectorStore
  keywordStore: IKeywordStore
  embedder: IEmbedder
  vectorWeight?: number
  keywordWeight?: number
  rrfK?: number
}

export class HybridRetriever implements IRetriever {
  private vectorStore: IVectorStore
  private keywordStore: IKeywordStore
  private embedder: IEmbedder
  private vectorWeight: number
  private keywordWeight: number
  private rrfK: number

  constructor(options: HybridRetrieverOptions) {
    this.vectorStore = options.vectorStore
    this.keywordStore = options.keywordStore
    this.embedder = options.embedder
    this.vectorWeight = options.vectorWeight ?? 0.7
    this.keywordWeight = options.keywordWeight ?? 0.3
    this.rrfK = options.rrfK ?? 60
  }

  async retrieve(
    query: Query,
    topK?: number,
    options?: HybridSearchOptions,
  ): Promise<RetrievalCandidate[]> {
    if (!query.original || query.original.trim() === '') return []
    if (query.kbIds.length === 0) return []

    const k = options?.rrfK ?? this.rrfK
    const limit = topK ?? 5

    let vectorResults: RetrievalCandidate[] = []
    let keywordResults: RetrievalCandidate[] = []

    // Try vector retrieval
    try {
      const [queryVector] = await this.embedder.embed([query.original])
      const vectorSearchResults = await this.vectorStore.searchVectors(queryVector, { topK: limit })
      vectorResults = vectorSearchResults.map((r) => ({
        // TODO: #adjacent-fix VectorSearchResult 缺少 chunk 完整信息，当前用占位值。真实场景需通过 chunkId 反查。
        chunk: {
          id: r.chunkId,
          documentId: '',
          kbId: query.kbIds[0],
          content: '',
          chunkIndex: 0,
        } as any,
        score: r.score,
        source: 'vector' as const,
      }))
    } catch {
      // vector failed, will fallback
    }

    // Try keyword retrieval
    try {
      keywordResults = await this.keywordStore.search(query.original, query.kbIds, limit)
    } catch {
      // keyword failed, will fallback
    }

    if (vectorResults.length === 0 && keywordResults.length === 0) {
      throw new RetrievalError('Both vector and keyword retrieval failed')
    }

    if (vectorResults.length === 0) return keywordResults
    if (keywordResults.length === 0) return vectorResults

    return reciprocalRankFusion([vectorResults, keywordResults], k)
  }
}
