/** 后端 SSE chunk 协议：POST /api/chat */
export interface SSEChunk {
  chunk: string
  done: boolean
  error?: string
}

/**
 * 解析 SSE 消息事件中的 JSON 数据
 * @returns 解析后的 SSEChunk，解析失败返回 null
 */
export function parseSSEChunk(event: { data: string }): SSEChunk | null {
  try {
    const parsed = JSON.parse(event.data) as SSEChunk
    return parsed
  } catch {
    return null
  }
}
