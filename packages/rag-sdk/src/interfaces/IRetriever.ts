import type { ChunkWithScore, HybridSearchOptions } from '../types.js'
import { ValidationError, RetrievalError } from '../errors.js'

/**
 * 语义检索抽象。
 *
 * 职责：将用户查询转换为向量，从向量数据库中检索最相关的文本块。
 *
 * 典型实现：
 * - 先调用 IEmbedder.embed([query]) 获取查询向量
 * - 再调用 IVectorStore.searchVectors 执行近似最近邻搜索
 * - 若启用混合检索，融合关键词匹配分数与向量相似度分数
 *
 * 边界行为：
 * - `query` 为空字符串或 `kbIds` 为空数组时应抛出 {@link ValidationError}
 * - 向量库查询超时或返回异常时应抛出 {@link RetrievalError}
 */
export interface IRetriever {
  /**
   * 执行语义检索。
   *
   * @param query - 用户查询文本，非空
   * @param kbIds - 目标知识库 ID 数组，至少包含一个元素
   * @param topK - 返回结果数量上限，默认 5
   * @param options - 混合检索参数（预留），由实现决定是否启用
   * @returns 按 `score` 降序排列的 ChunkWithScore 数组
   * @throws {ValidationError} 当 `query` 为空或 `kbIds` 为空数组时
   * @throws {RetrievalError} 当检索超时或向量库查询失败时
   */
  retrieve(
    query: string,
    kbIds: string[],
    topK?: number,
    options?: HybridSearchOptions,
  ): Promise<ChunkWithScore[]>
}
