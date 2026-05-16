import type { VectorStoreError } from './errors.js'

/** 向量记录 */
export interface VectorRecord {
  /** Milvus 主键（VARCHAR） */
  id: string
  /** 关联 PostgreSQL chunks.id */
  chunkId: string
  /** 知识库 ID，用于过滤 */
  kbId: string
  /** 文档 ID */
  fileId: string
  /** 向量数据，维度 1536（默认） */
  embedding: number[]
}

/** 向量搜索选项 */
export interface VectorSearchOptions {
  /** 返回结果数量，默认 5 */
  topK?: number
  /** 过滤条件，当前仅支持 kbId 精确匹配（MVP） */
  filter?: {
    kbId?: string
  }
}

/** 向量搜索结果 */
export interface VectorSearchResult {
  /** Milvus 主键 */
  id: string
  /** 关联 chunkId */
  chunkId: string
  /** 相似度分数（0~1，越高越相似） */
  score: number
}

/**
 * 向量存储抽象，屏蔽 sqlite-vec（V1）与 Milvus（V2）的差异。
 */
export interface IVectorStore {
  /**
   * 批量插入向量记录。
   * @param vectors — 向量记录数组
   * @returns void
   * @throws VectorStoreError — 插入失败（如维度不匹配、连接中断）
   */
  insertVectors(vectors: VectorRecord[]): Promise<void>

  /**
   * ANN 近似最近邻搜索。
   * @param queryVector — 查询向量（维度必须与 collection 一致）
   * @param options — 搜索选项（过滤条件、返回数量）
   * @returns 搜索结果数组（按相似度降序）
   * @throws VectorStoreError — 搜索失败
   */
  searchVectors(
    queryVector: number[],
    options?: VectorSearchOptions
  ): Promise<VectorSearchResult[]>

  /**
   * 根据 Milvus 主键删除向量。
   * @param ids — 要删除的向量 ID 数组
   * @returns void
   * @throws VectorStoreError — 删除失败
   */
  deleteByIds(ids: string[]): Promise<void>

  /**
   * 幂等地创建/校验 collection 结构。
   * 应用启动时调用一次，确保 collection 存在且字段类型正确。
   * @returns void
   * @throws VectorStoreError — 创建失败（如权限不足、维度参数非法）
   */
  ensureCollection(): Promise<void>
}
