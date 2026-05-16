import type { EmbeddingConfig } from '../types.js'
import { ValidationError, EmbeddingError } from '../errors.js'

/**
 * 文本向量化抽象。
 *
 * 职责：将字符串数组转换为高维向量数组，用于语义检索。
 *
 * 典型实现：
 * - 调用 OpenAI / Cohere / 本地 ONNX 嵌入模型
 * - 对输入文本做截断或拼接预处理
 *
 * 边界行为：
 * - 空数组输入应抛出 {@link ValidationError}
 * - 返回向量维度与 {@link EmbeddingConfig.dimension} 不匹配时应抛出 {@link EmbeddingError}
 * - 单次批量上限由实现决定，对外表现为单次调用
 */
export interface IEmbedder {
  /**
   * 将文本数组批量转换为向量数组。
   *
   * @param texts - 待嵌入的纯文本数组，长度 >= 1
   * @returns 与输入一一对应的高维向量数组，每个向量长度为 `config.dimension`
   * @throws {ValidationError} 当 `texts` 为空数组时
   * @throws {EmbeddingError} 当嵌入 API 失败或返回维度不匹配时
   */
  embed(texts: string[]): Promise<number[][]>

  /**
   * 当前 Embedder 的配置信息（只读）。
   *
   * 用于调用方校验维度、提供商等元数据，避免硬编码。
   */
  readonly config: Readonly<EmbeddingConfig>
}
