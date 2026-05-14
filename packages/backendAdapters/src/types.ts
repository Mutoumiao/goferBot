export type Unlisten = () => void

export interface Subscription {
  unlisten: Unlisten
  /** SSE 连接关闭时 resolve */
  completed: Promise<void>
}

export interface BackendTransport {
  /** 统一 HTTP 请求，返回原生 Response */
  request(
    method: string,
    path: string,
    body?: object,
    options?: RequestInit,
  ): Promise<Response>

  /** SSE 订阅，handler 接收 (data: string, eventType?: string)，completed 在连接关闭时 resolve */
  subscribe(
    path: string,
    body: object,
    handler: (data: string, eventType?: string) => void,
  ): Subscription

  /** 健康检查 */
  isReady(): Promise<boolean>

  /** 清理资源（测试/页面卸载使用） */
  dispose(): void
}
