import type { RetrievalCandidate } from '../types.js'

export interface KeywordSearchOptions {
  topK?: number
}

export interface KeywordSearchResult {
  candidates: RetrievalCandidate[]
}

/**
 * 关键词存储抽象。
 *
 * 由 server 的 PostgreSQL FTS 实现，支持混合检索的关键词分支。
 * 空 query 或空 kbIds 应返回空数组 []。
 * 返回的 RetrievalCandidate.source 必须为 'keyword'。
 * 失败时抛出 RetrievalError。
 */
export interface IKeywordStore {
  search(query: string, kbIds: string[], topK?: number): Promise<RetrievalCandidate[]>
}
