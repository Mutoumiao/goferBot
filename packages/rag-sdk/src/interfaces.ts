/**
 * 跨模块能力接口定义
 *
 * 所有接口由具体实现类实现，server 通过依赖注入将实现传入 SDK。
 */

import type { DocumentSource, Chunk, Query, RetrievalCandidate, EmbeddingConfig, HybridSearchOptions } from './types.js'

/**
 * 文档分块策略抽象。
 *
 * 将文档纯文本内容按策略切分为语义完整的文本块。
 * 空内容应返回空数组 []，重叠配置非法时应抛出 ValidationError。
 */
export interface IChunker {
  chunk(doc: DocumentSource): Promise<Chunk[]>
}

/**
 * 文本向量化抽象。
 *
 * 将字符串数组转换为高维向量数组，用于语义检索。
 * 空数组输入应抛出 ValidationError，维度不匹配时应抛出 EmbeddingError。
 */
export interface IEmbedder {
  embed(texts: string[]): Promise<number[][]>
  readonly config: Readonly<EmbeddingConfig>
}

/**
 * 向量索引写入抽象。
 *
 * 将分块后的文本及其向量批量写入向量数据库。
 * chunks 与 vectors 长度不匹配时应抛出 ValidationError。
 */
export interface IIndexer {
  index(chunks: Chunk[], vectors: number[][]): Promise<void>
}

/**
 * 混合检索抽象（向量 + 关键词 + RRF 融合）。
 *
 * 入参为结构化 Query 对象（非简单字符串）。
 * query.original 为空或 query.kbIds 为空数组时应抛出 ValidationError。
 */
export interface IRetriever {
  retrieve(
    query: Query,
    topK?: number,
    options?: HybridSearchOptions,
  ): Promise<RetrievalCandidate[]>
}

/**
 * 重排序抽象。
 *
 * 对检索候选进行重排序，提升结果质量。
 */
export interface IReranker {
  rerank(candidates: RetrievalCandidate[], query: Query): Promise<RetrievalCandidate[]>
}

/**
 * 生成器抽象。
 *
 * 基于查询和上下文 chunks 生成回答文本。
 */
export interface IGenerator {
  generate(input: { query: Query; chunks: Chunk[] }): Promise<string>
}

/**
 * 关键词存储抽象。
 *
 * 由 server 的 PostgreSQL FTS 实现，支持混合检索的关键词分支。
 */
export interface IKeywordStore {
  search(query: string, kbIds: string[], topK?: number): Promise<RetrievalCandidate[]>
}
