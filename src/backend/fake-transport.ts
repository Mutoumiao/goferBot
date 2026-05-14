import type { BackendTransport, Subscription } from './types'

interface RequestRecord {
  method: string
  path: string
  body?: object
}

interface ResponseConfig {
  status: number
  body: unknown
  headers?: Record<string, string>
}

interface SSERecord {
  data: string
  eventType?: string
}

export class FakeBackendTransport implements BackendTransport {
  private responses = new Map<string, ResponseConfig>()
  private sseResponses = new Map<string, SSERecord[]>()
  private requestHistory: RequestRecord[] = []

  when(method: string, path: string) {
    const key = `${method} ${path}`
    return {
      respond: (status: number, body: unknown) => {
        this.responses.set(key, { status, body })
        return this
      },
      respondSSE: (events: Array<{ data: string; event?: string }>) => {
        this.sseResponses.set(
          key,
          events.map((e) => ({ data: e.data, eventType: e.event })),
        )
        return this
      },
    }
  }

  async request(
    method: string,
    path: string,
    body?: object,
    _options?: RequestInit,
  ): Promise<Response> {
    this.requestHistory.push({ method, path, body })
    const key = `${method} ${path}`
    const config = this.responses.get(key)

    if (!config) {
      return new Response(JSON.stringify({ error: 'No mock configured' }), {
        status: 404,
      })
    }

    return new Response(JSON.stringify(config.body), {
      status: config.status,
      headers: config.headers || { 'Content-Type': 'application/json' },
    })
  }

  subscribe(
    path: string,
    body: object,
    handler: (data: string, eventType?: string) => void,
  ): Subscription {
    const key = `POST ${path}`
    this.requestHistory.push({ method: 'POST', path, body })
    const events = this.sseResponses.get(key)

    let completedResolve: (() => void) | null = null
    const completedPromise = new Promise<void>((resolve) => {
      completedResolve = resolve
    })

    if (events) {
      // 异步触发所有事件，完成后 resolve
      setTimeout(() => {
        events.forEach((e) => handler(e.data, e.eventType || undefined))
        completedResolve?.()
      }, 0)
    } else {
      completedResolve?.()
    }

    return {
      unlisten: () => {},
      completed: completedPromise,
    }
  }

  async isReady(): Promise<boolean> {
    return true
  }

  dispose(): void {
    this.responses.clear()
    this.sseResponses.clear()
    this.requestHistory = []
  }

  // 断言辅助方法
  getRequestHistory(): RequestRecord[] {
    return this.requestHistory
  }

  wasRequestCalled(method: string, path: string): boolean {
    return this.requestHistory.some((r) => r.method === method && r.path === path)
  }
}
