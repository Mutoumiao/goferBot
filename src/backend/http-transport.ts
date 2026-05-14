import type { Shell } from '@/shell/types'
import type { BackendTransport, Subscription } from './types'

const DEFAULT_RETRIES = 3
const RETRY_DELAY_BASE = 300

export class HttpBackendTransport implements BackendTransport {
  private currentPort: number | null = null
  private readyUnlisten: (() => void) | null = null
  private restartedUnlisten: (() => void) | null = null

  constructor(private shell: Shell) {
    // 启动端口监听（fire-and-forget，错误已捕获）
    this.startPortSync().catch(() => {})
  }

  private async startPortSync(): Promise<void> {
    try {
      const port = await this.shell.getSidecarPort()
      if (port !== null) this.currentPort = port
    } catch {
      // ignore
    }
    try {
      this.readyUnlisten = await this.shell.onSidecarReady((event) => {
        this.currentPort = event.port
      })
      this.restartedUnlisten = await this.shell.onSidecarRestarted((event) => {
        this.currentPort = event.port
      })
    } catch {
      // ignore — browser shell may not support listeners
    }
  }

  private async resolvePort(): Promise<number> {
    if (this.currentPort !== null) return this.currentPort
    const port = await this.shell.getSidecarPort()
    if (port !== null) {
      this.currentPort = port
      return port
    }
    throw new Error('Sidecar port not available')
  }

  async request(
    method: string,
    path: string,
    body?: object,
    options: RequestInit = {},
  ): Promise<Response> {
    const port = await this.resolvePort()
    const url = `http://127.0.0.1:${port}${path}`
    const init: RequestInit = {
      ...options,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    }
    if (body) {
      init.body = JSON.stringify(body)
    }

    // 重试逻辑
    for (let i = 0; i <= DEFAULT_RETRIES; i++) {
      try {
        const response = await fetch(url, init)
        if (response.ok || i === DEFAULT_RETRIES) {
          return response
        }
      } catch (err) {
        if (i === DEFAULT_RETRIES) throw err
        await new Promise((r) => setTimeout(r, RETRY_DELAY_BASE * (i + 1)))
      }
    }

    // 不可达：循环已覆盖所有重试情况
    throw new Error('Unexpected: retry loop exhausted without returning')
  }

  subscribe(
    path: string,
    body: object,
    handler: (data: string, eventType?: string) => void,
  ): Subscription {
    const abortController = new AbortController()
    let completedResolve: (() => void) | null = null
    const completedPromise = new Promise<void>((resolve) => {
      completedResolve = resolve
    })

    const run = async () => {
      try {
        const port = await this.resolvePort()
        const url = `http://127.0.0.1:${port}${path}`
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: abortController.signal,
        })

        if (!response.body) {
          completedResolve?.()
          return
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let currentEvent = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim()
              continue
            }
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6)
            if (data === '[DONE]') continue
            handler(data, currentEvent || undefined)
            currentEvent = ''
          }
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          console.error('[BackendTransport] SSE error:', e)
        }
      } finally {
        completedResolve?.()
      }
    }

    run()

    return {
      unlisten: () => {
        abortController.abort()
      },
      completed: completedPromise,
    }
  }

  async isReady(): Promise<boolean> {
    try {
      const port = await this.resolvePort()
      const res = await fetch(`http://127.0.0.1:${port}/health`, {
        signal: AbortSignal.timeout(2000),
      })
      return res.ok
    } catch {
      return false
    }
  }

  dispose(): void {
    this.readyUnlisten?.()
    this.restartedUnlisten?.()
    this.readyUnlisten = null
    this.restartedUnlisten = null
  }
}
