/**
 * 向量存储接口
 *
 * 定义 SDK 与向量数据库（Milvus）之间的契约。
 * server 的 VectorService 实现此接口，通过构造函数注入 SDK。
 */

export interface VectorRecord {
  /** Milvus 主键（VARCHAR） */
  id: string
  /** 关联 PostgreSQL chunks.id */
  chunkId: string
  /** 知识库 ID，用于过滤 */
  kbId: string
  /** 文档 ID */
  fileId: string
  /** 向量数据 */
  embedding: number[]
}

export interface VectorSearchOptions {
  /** 返回结果数量，默认 5 */
  topK?: number
  /** 过滤条件，当前仅支持 kbId 精确匹配 */
  filter?: {
    kbId?: string
  }
}

export interface VectorSearchResult {
  /** Milvus 主键 */
  id: string
  /** 关联 chunkId */
  chunkId: string
  /** 相似度分数（0~1，越高越相似） */
  score: number
}

export interface IVectorStore {
  /** 批量插入向量记录 */
  insertVectors(vectors: VectorRecord[]): Promise<void>
  /** ANN 近似最近邻搜索 */
  searchVectors(
    queryVector: number[],
    options?: VectorSearchOptions,
  ): Promise<VectorSearchResult[]>
  /** 根据 ID 删除向量 */
  deleteByIds(ids: string[]): Promise<void>
  /** 幂等地创建/校验 collection 结构 */
  ensureCollection(): Promise<void>
}
