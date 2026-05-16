import type { Chunk } from '../types.js'
import { ValidationError, EmbeddingError, RAGError } from '../errors.js'

/**
 * 向量索引写入抽象。
 *
 * 职责：将分块后的文本及其向量批量写入向量数据库，并回写关联 ID。
 *
 * 生命周期位置：
 * `IChunker.chunk` → `IEmbedder.embed` → `IIndexer.index` → `IVectorStore.insertVectors`
 *
 * 典型实现：
 * - 校验 `chunks` 与 `vectors` 长度一致性
 * - 校验每个向量维度与 `EmbeddingConfig.dimension` 一致性
 * - 将数据映射为 `IVectorStore.insertVectors` 所需的 `VectorRecord[]`
 *
 * 边界行为：
 * - `chunks` 与 `vectors` 长度不匹配时应抛出 {@link ValidationError}
 * - 向量维度不匹配时应抛出 {@link EmbeddingError}
 * - 向量库写入失败时应抛出 {@link RAGError}
 */
export interface IIndexer {
  /**
   * 将文本块及其向量批量写入向量索引。
   *
   * @param chunks - 已持久化到 PostgreSQL 的 Chunk 数组
   * @param vectors - 与 `chunks` 一一对应的嵌入向量数组
   * @throws {ValidationError} 当 `chunks` 与 `vectors` 长度不一致时
   * @throws {EmbeddingError} 当向量维度与配置不匹配时
   * @throws {RAGError} 当向量库写入失败时
   */
  index(chunks: Chunk[], vectors: number[][]): Promise<void>
}
