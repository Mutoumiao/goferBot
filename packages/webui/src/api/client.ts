import { ApiError, NetworkError } from './errors'
import type {
  RequestConfig,
  SSEConfig,
  SSECallbacks,
  RequestInterceptor,
  ResponseInterceptor,
  CreateApiClientOptions,
  JwtTokens,
} from './types'

const DEFAULT_BASE_URL = 'http://localhost:3000'
const DEFAULT_TIMEOUT = 30000
const DEFAULT_SSE_TIMEOUT = 300000

function mergeSignals(signals: (AbortSignal | undefined | null)[]): AbortSignal | undefined {
  const valid = signals.filter((s): s is AbortSignal => !!s)
  if (valid.length === 0) return undefined
  if (valid.length === 1) return valid[0]
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  for (const s of valid) {
    if (s.aborted) {
      controller.abort()
      return controller.signal
    }
    s.addEventListener('abort', onAbort, { once: true })
  }
  return controller.signal
}

export interface ApiClient {
  get<T = unknown>(
    path: string,
    options?: Pick<RequestConfig, 'headers' | 'timeout' | 'signal'>
  ): Promise<T>
  post<T = unknown>(
    path: string,
    body?: unknown,
    options?: Pick<RequestConfig, 'headers' | 'timeout' | 'signal'>
  ): Promise<T>
  patch<T = unknown>(
    path: string,
    body?: unknown,
    options?: Pick<RequestConfig, 'headers' | 'timeout' | 'signal'>
  ): Promise<T>
  delete(
    path: string,
    options?: Pick<RequestConfig, 'headers' | 'timeout' | 'signal'>
  ): Promise<void>
  sse<T = unknown>(
    path: string,
    body: unknown,
    callbacks: SSECallbacks<T>,
    options?: SSEConfig
  ): void
  addRequestInterceptor(interceptor: RequestInterceptor): void
  addResponseInterceptor(interceptor: ResponseInterceptor): void
  onUnauthorized: ((error: ApiError) => void) | null
}

export function createApiClient(options?: CreateApiClientOptions): ApiClient {
  const baseURL = options?.baseURL ?? import.meta.env.VITE_API_BASE_URL ?? DEFAULT_BASE_URL
  const defaultHeaders = options?.defaultHeaders ?? {}
  const defaultTimeout = options?.defaultTimeout ?? DEFAULT_TIMEOUT

  const requestInterceptors: RequestInterceptor[] = []
  const responseInterceptors: ResponseInterceptor[] = []

  let isRefreshing = false
  let refreshPromise: Promise<JwtTokens> | null = null

  const client: ApiClient = {
    onUnauthorized: null,

    addRequestInterceptor(interceptor) {
      requestInterceptors.push(interceptor)
    },

    addResponseInterceptor(interceptor) {
      responseInterceptors.push(interceptor)
    },

    async get<T>(path, options = {}) {
      return request<T>({ method: 'GET', path, ...options })
    },

    async post<T>(path, body, options = {}) {
      return request<T>({ method: 'POST', path, body, ...options })
    },

    async patch<T>(path, body, options = {}) {
      return request<T>({ method: 'PATCH', path, body, ...options })
    },

    async delete(path, options = {}) {
      return request<void>({ method: 'DELETE', path, ...options })
    },

    sse<T>(path, body, callbacks, options = {}) {
      const url = `${baseURL}${path}`
      const timeout = options.timeout ?? DEFAULT_SSE_TIMEOUT
      const timeoutController = new AbortController()
      const timeoutId = setTimeout(() => timeoutController.abort(), timeout)
      const signal = mergeSignals([options.signal, timeoutController.signal])

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...defaultHeaders,
        ...options.headers,
      }

      fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal,
      })
        .then(async (res) => {
          clearTimeout(timeoutId)
          if (!res.ok) {
            const err = await parseApiError(res)
            callbacks.onError(err)
            return
          }
          if (!res.body) {
            callbacks.onError(new NetworkError('SSE response has no body'))
            return
          }
          const reader = res.body.getReader()
          const decoder = new TextDecoder()
          let buffer = ''

          try {
            while (true) {
              if (signal?.aborted) {
                await reader.cancel()
                callbacks.onError(new NetworkError('Aborted'))
                return
              }
              const { done, value } = await reader.read()
              if (done) {
                callbacks.onDone()
                return
              }
              buffer += decoder.decode(value, { stream: true })
              const lines = buffer.split('\n')
              buffer = lines.pop() ?? ''
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6)
                  try {
                    const parsed = JSON.parse(data)
                    callbacks.onChunk(parsed)
                  } catch (e) {
                    callbacks.onError(new NetworkError(`SSE data parse error: ${String(e)}`, data))
                  }
                }
                if (line.startsWith('event: ')) {
                  const eventType = line.slice(7)
                  if (eventType === 'error') {
                    callbacks.onError(new NetworkError('SSE event error'))
                  }
                }
              }
            }
          } catch (e) {
            callbacks.onError(new NetworkError('SSE read error', e))
          } finally {
            await reader.cancel().catch(() => {
              // ignore cancel errors
            })
          }
        })
        .catch((e) => {
          clearTimeout(timeoutId)
          if (e instanceof NetworkError) {
            callbacks.onError(e)
          } else {
            callbacks.onError(new NetworkError(e instanceof Error ? e.message : String(e), e))
          }
        })
    },
  }

  async function request<T>(config: RequestConfig, isRetry = false): Promise<T> {
    let cfg = { ...config }
    cfg.headers = { ...defaultHeaders, ...cfg.headers }
    cfg.timeout = cfg.timeout ?? defaultTimeout

    for (const interceptor of requestInterceptors) {
      try {
        cfg = await interceptor(cfg)
      } catch (e) {
        throw new NetworkError(`Request interceptor failed: ${e instanceof Error ? e.message : String(e)}`, e)
      }
    }

    const url = `${baseURL}${cfg.path}`
    const init: RequestInit = {
      method: cfg.method,
      headers: {
        'Content-Type': 'application/json',
        ...cfg.headers,
      },
    }

    if (cfg.body !== undefined && cfg.method !== 'GET') {
      init.body = JSON.stringify(cfg.body)
    }

    const timeoutController = new AbortController()
    const timeoutId = setTimeout(() => timeoutController.abort(), cfg.timeout!)
    init.signal = mergeSignals([cfg.signal, timeoutController.signal])

    let res: Response
    try {
      res = await fetch(url, init)
    } catch (e) {
      clearTimeout(timeoutId)
      throw new NetworkError(e instanceof Error ? e.message : String(e), e)
    }
    clearTimeout(timeoutId)

    for (const interceptor of responseInterceptors) {
      try {
        res = await interceptor(res, cfg)
      } catch (e) {
        throw new NetworkError(`Response interceptor failed: ${e instanceof Error ? e.message : String(e)}`, e)
      }
    }

    // 401 自动刷新
    if (res.status === 401 && !isRetry) {
      const newTokens = await doRefresh()
      if (newTokens) {
        // 重试原请求
        cfg.headers = {
          ...cfg.headers,
          Authorization: `Bearer ${newTokens.accessToken}`,
        }
        return request<T>(cfg, true)
      }
    }

    if (res.status === 401 && client.onUnauthorized) {
      const err = await parseApiError(res)
      client.onUnauthorized(err)
      throw err
    }

    if (!res.ok) {
      throw await parseApiError(res)
    }

    if (cfg.method === 'DELETE' || res.status === 204) {
      return undefined as unknown as T
    }

    try {
      const json = await res.json()
      // 自动解包 NestJS { data: T } 格式
      if (json && typeof json === 'object' && 'data' in json) {
        return json.data as T
      }
      return json as T
    } catch {
      return undefined as T
    }
  }

  let refreshFailed = false

  async function doRefresh(): Promise<JwtTokens | null> {
    if (refreshFailed) {
      return null
    }
    if (isRefreshing) {
      return refreshPromise!
    }

    const savedRefresh = localStorage.getItem('goferbot_refresh_token')
    if (!savedRefresh) {
      return null
    }

    isRefreshing = true
    refreshPromise = fetch(`${baseURL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: savedRefresh }),
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error('Refresh failed')
        }
        const json = await res.json()
        const tokens = json.data ?? json
        localStorage.setItem('goferbot_access_token', tokens.accessToken)
        localStorage.setItem('goferbot_refresh_token', tokens.refreshToken)
        return tokens as JwtTokens
      })
      .catch((e) => {
        refreshFailed = true
        localStorage.removeItem('goferbot_access_token')
        localStorage.removeItem('goferbot_refresh_token')
        if (client.onUnauthorized) {
          client.onUnauthorized(new ApiError({ status: 401, code: 'REFRESH_FAILED', message: String(e) }))
        }
        throw e
      })
      .finally(() => {
        isRefreshing = false
        refreshPromise = null
      })

    return refreshPromise
  }

  async function parseApiError(res: Response): Promise<ApiError> {
    let raw: unknown
    let message = res.statusText
    let code = `HTTP_${res.status}`
    try {
      const body = await res.json()
      raw = body
      if (body && typeof body === 'object') {
        if ('error' in body && typeof body.error === 'string') {
          message = body.error
        }
        if ('code' in body && typeof body.code === 'string') {
          code = body.code
        }
        if ('message' in body && typeof body.message === 'string') {
          message = body.message
        }
        // NestJS 统一错误格式 { error: { code, message } }
        if ('error' in body && body.error && typeof body.error === 'object') {
          const errObj = body.error as Record<string, unknown>
          if (typeof errObj.code === 'string') code = errObj.code
          if (typeof errObj.message === 'string') message = errObj.message
        }
      }
    } catch {
      try {
        raw = await res.text()
      } catch {
        raw = undefined
      }
    }
    return new ApiError({ status: res.status, code, message, raw })
  }

  return client
}

export const api: ApiClient = createApiClient()
