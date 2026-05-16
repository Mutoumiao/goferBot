/**
 * RAG SDK 错误类型体系
 *
 * 所有错误均继承自原生 `Error`，支持可选的 `cause` 链式追溯。
 */

/**
 * RAG 错误基类。
 *
 * 所有 RAG 相关错误的根类，用于统一捕获。
 */
export class RAGError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause })
    this.name = 'RAGError'
  }
}

/**
 * 向量化错误。
 *
 * 触发场景：
 * - 嵌入 API 调用失败（网络、鉴权、限流）
 * - 返回向量维度与 `EmbeddingConfig.dimension` 不匹配
 * - 本地嵌入模型加载失败
 */
export class EmbeddingError extends RAGError {
  constructor(message: string, cause?: unknown) {
    super(message, { cause })
    this.name = 'EmbeddingError'
  }
}

/**
 * 检索错误。
 *
 * 触发场景：
 * - 向量数据库查询超时或连接断开
 * - 向量库返回异常状态
 * - 混合检索参数非法
 */
export class RetrievalError extends RAGError {
  constructor(message: string, cause?: unknown) {
    super(message, { cause })
    this.name = 'RetrievalError'
  }
}

/**
 * 校验错误。
 *
 * 触发场景：
 * - 输入参数为空或格式非法（如空字符串、空数组）
 * - 数组长度不匹配（如 chunks 与 vectors 长度不一致）
 * - 配置项缺失或越界
 *
 * 注意：ValidationError 不接受 `cause`，因为它代表调用方逻辑错误而非底层故障。
 */
export class ValidationError extends RAGError {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}
