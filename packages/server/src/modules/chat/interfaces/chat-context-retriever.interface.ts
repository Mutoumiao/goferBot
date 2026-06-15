/**
 * Chat 模块检索端口。
 * 为后续接入 RAG 检索预留抽象边界；Chat 模块不依赖 Knowledge-base 业务实现。
 */
export interface ChatContextRetrieveOptions {
  /** 指定用于检索的知识库 ID 列表 */
  kbIds?: string[]
  /** 保留扩展能力，供后续检索选项使用 */
  [key: string]: unknown
}

export interface ChatContextRetriever {
  /**
   * 根据用户查询检索外部上下文。
   * @param userId 当前用户 ID
   * @param query 用户输入的查询文本
   * @param options 检索选项，可指定知识库 ID 等
   * @returns 检索到的上下文；无结果返回 null
   */
  retrieve(
    userId: string,
    query: string,
    options?: ChatContextRetrieveOptions,
  ): Promise<{ context: string | null }>
}

export const CHAT_CONTEXT_RETRIEVER = Symbol('CHAT_CONTEXT_RETRIEVER')
