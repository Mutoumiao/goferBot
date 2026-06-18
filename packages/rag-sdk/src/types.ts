/**
 * RAG SDK 共享类型定义
 *
 * 所有类型由 Zod Schema 推导（z.infer），确保运行时校验与编译时类型一致。
 */

import type { z } from 'zod'
import type {
  ChunkSchema,
  ChunkWithScoreSchema,
  DocumentSourceSchema,
  EmbeddingConfigSchema,
  HybridSearchOptionsSchema,
  QuerySchema,
  RetrievalCandidateSchema,
} from './schema.js'

/**
 * 文档源输入。
 *
 * 表示待分块的原始文档，由解析器（Parser）产出后传入 IChunker。
 */
export type DocumentSource = z.infer<typeof DocumentSourceSchema>

/**
 * 查询对象。
 *
 * 不是简单字符串，而是结构化的检索请求，支持重写、扩展、过滤。
 */
export type Query = z.infer<typeof QuerySchema>

/**
 * 文本块。
 *
 * IChunker 的输出单元，每个 Chunk 对应原始文档中的一个语义片段。
 * 支持 Small-to-Big Retrieval（parentId）和层级索引（hierarchyPath）。
 */
export type Chunk = z.infer<typeof ChunkSchema>

/**
 * 带相关度分数的文本块。
 *
 * IRetriever 的检索结果单元。
 */
export type ChunkWithScore = z.infer<typeof ChunkWithScoreSchema>

/**
 * 检索候选。
 *
 * 包含 chunk、分数、来源等完整信息，供 post-retrieval 处理。
 */
export type RetrievalCandidate = z.infer<typeof RetrievalCandidateSchema>

/**
 * 向量化配置。
 *
 * 描述 Embedder 所需的提供商、模型及维度信息。
 */
export type EmbeddingConfig = z.infer<typeof EmbeddingConfigSchema>

/**
 * 混合检索参数。
 *
 * 供 IRetriever.retrieve 使用，支持向量检索与关键词检索的融合策略。
 */
export type HybridSearchOptions = z.infer<typeof HybridSearchOptionsSchema>

/**
 * 单条文本的 Token 用量。
 *
 * 由 IEmbedder.embedWithUsage() 返回，供下游 IIndexer 写入精确 tokenCount。
 * promptTokens 与 totalTokens 在 Embedding 场景下通常相等，因为 Embedding API
 * 不生成输出 token，保留两个字段以兼容未来可能产生 completion token 的 embedder。
 */
export interface TokenUsage {
  /** 输入文本消耗的 prompt token 数（非负整数）。 */
  promptTokens: number

  /** 总 token 数（prompt + completion）。在纯 Embedding 场景下等于 promptTokens。 */
  totalTokens: number
}

/**
 * embedWithUsage() 的返回结构。
 *
 * vectors 与 usage 数组长度严格等于输入 texts 的长度，且按相同索引一一对应。
 */
export interface EmbedWithUsageResult {
  /** 向量化结果。vectors[i] 对应 texts[i] 的嵌入向量。 */
  vectors: number[][]

  /** 逐条 token 用量。usage[i] 对应 texts[i] 的用量。 */
  usage: TokenUsage[]
}
