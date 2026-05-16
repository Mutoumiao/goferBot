import type { Chunk, DocumentSource } from '../types.js'
import { ValidationError } from '../errors.js'

/**
 * 文档分块策略抽象。
 *
 * 职责：将文档纯文本内容按策略切分为语义完整的文本块。
 *
 * 典型实现：
 * - 固定字符长度切分
 * - 递归字符切分（按段落/句子/单词层级）
 * - 语义切分（基于句子嵌入相似度）
 *
 * 边界行为：
 * - 空内容应返回空数组 `[]`
 * - 重叠配置非法时应抛出 {@link ValidationError}
 */
export interface IChunker {
  /**
   * 将单个文档切分为文本块数组。
   *
   * @param doc - 文档源输入，包含已提取的纯文本内容
   * @returns 按 `chunkIndex` 递增排序的 Chunk 数组
   * @throws {ValidationError} 当输入内容格式非法或分块参数冲突时
   */
  chunk(doc: DocumentSource): Promise<Chunk[]>
}
