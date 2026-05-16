/**
 * RAG SDK 共享类型定义
 *
 * 涵盖分块、向量化、检索三个阶段的输入/输出数据结构。
 */

/**
 * 文档源输入。
 *
 * 表示待分块的原始文档，由解析器（Parser）产出后传入 IChunker。
 */
export interface DocumentSource {
  /** 文档在 PostgreSQL 中的持久化 ID */
  documentId: string

  /** 所属知识库 ID */
  kbId: string

  /** 文档纯文本内容（已提取） */
  content: string

  /** MIME 类型，如 `text/plain`、`application/pdf` */
  mimeType: string
}

/**
 * 文本块。
 *
 * IChunker 的输出单元，每个 Chunk 对应原始文档中的一个语义片段。
 */
export interface Chunk {
  /** 块全局唯一 ID（由分块实现生成） */
  id: string

  /** 来源文档 ID */
  documentId: string

  /** 所属知识库 ID */
  kbId: string

  /** 块纯文本内容 */
  content: string

  /** 块在文档内的递增序号，从 0 开始 */
  chunkIndex: number

  /** 预估 token 数（可选，由实现决定） */
  tokenCount?: number
}

/**
 * 带相关度分数的文本块。
 *
 * IRetriever 的检索结果，按 `score` 降序排列。
 */
export interface ChunkWithScore extends Chunk {
  /** 相关度分数，越高越相关 */
  score: number
}

/**
 * 向量化配置。
 *
 * 描述 Embedder 所需的提供商、模型及维度信息。
 * 维度不从接口层硬编码，由消费方根据配置传入。
 */
export interface EmbeddingConfig {
  /** 提供商标识，如 `openai`、`cohere`、`local` */
  provider: string

  /** 模型名称，如 `text-embedding-3-small` */
  model: string

  /** 输出向量维度 */
  dimension: number

  /** API 密钥（若本地模型可为空字符串） */
  apiKey: string

  /** 自定义 API 基础地址（可选） */
  baseUrl?: string
}

/**
 * 混合检索参数（预留）。
 *
 * 供 IRetriever.retrieve 使用，支持向量检索与关键词检索的融合策略。
 * 当前版本仅定义字段，具体融合算法由实现层决定。
 */
export interface HybridSearchOptions {
  /** 向量检索权重，范围 0~1 */
  vectorWeight?: number

  /** 关键词检索权重，范围 0~1 */
  keywordWeight?: number

  /** RRF（Reciprocal Rank Fusion）融合参数 k */
  rrfK?: number
}
