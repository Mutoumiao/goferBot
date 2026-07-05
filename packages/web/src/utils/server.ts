import { createAlova } from 'alova'
import adapterFetch from 'alova/fetch'
import ReactHook from 'alova/react'

let isRefreshing = false
let refreshSubscribers: Array<{ resolve: () => void; reject: (err: Error) => void }> = []

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

async function refreshToken(): Promise<boolean> {
  const response = await fetch(`${API_BASE_URL}/web/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-App-Context': 'web',
    },
    body: '{}',
  })
  return response.ok
}

function onRefreshed() {
  for (const cb of refreshSubscribers) cb.resolve()
  refreshSubscribers = []
}

function onRefreshFailed(err: Error) {
  for (const cb of refreshSubscribers) cb.reject(err)
  refreshSubscribers = []
}

function addSubscriber(cb: { resolve: () => void; reject: (err: Error) => void }) {
  refreshSubscribers.push(cb)
}

interface AlovaMethod {
  send: () => unknown
  config: { headers: Record<string, string> }
}

async function doRefreshAndRetry(method: AlovaMethod) {
  if (!isRefreshing) {
    isRefreshing = true
    try {
      const ok = await refreshToken()
      if (ok) {
        onRefreshed()
        return method.send()
      }
      const err = new Error('Auth refresh failed')
      onRefreshFailed(err)
      throw err
    } catch (err) {
      onRefreshFailed(err instanceof Error ? err : new Error('Refresh error'))
      throw err
    } finally {
      isRefreshing = false
    }
  }
  return new Promise<unknown>((resolve, reject) => {
    addSubscriber({
      resolve: () => {
        resolve(method.send())
      },
      reject,
    })
  })
}

function isUnauthorized(status: number) {
  return status === 401 || status === 403
}

function isLoginPage() {
  return window.location.pathname === '/login'
}

const responded = {
  onSuccess(response: Response, method: AlovaMethod) {
    if (isUnauthorized(response.status) && !isLoginPage()) {
      return doRefreshAndRetry(method)
    }
    if (!response.ok) {
      return response
        .clone()
        .json()
        .catch(() => null)
        .then((body: unknown) => {
          const payload =
            body && typeof body === 'object' && 'error' in (body as object)
              ? (body as { error?: { code?: string; message?: string } }).error
              : (body as { code?: string; message?: string } | null)
          const message =
            (payload && typeof payload === 'object' && 'message' in payload && payload.message) ||
            `HTTP ${response.status}: ${response.statusText}`
          const code =
            payload && typeof payload === 'object' && 'code' in payload ? payload.code : undefined
          const err = new Error(message) as Error & {
            status?: number
            code?: string
            cause?: unknown
          }
          err.status = response.status
          err.code = code as string | undefined
          err.cause = body
          throw err
        })
    }
    return response.json().then((json: Record<string, unknown>) => json.data ?? json)
  },
  onError(error: { status?: number }, method: AlovaMethod) {
    const status = error.status
    if (status && isUnauthorized(status) && !isLoginPage()) {
      return doRefreshAndRetry(method)
    }
    throw error
  },
}

export const alovaInstance = createAlova({
  // @ts-expect-error: 自定义 responded handler 签名
  responded,
  id: 'goferbot',
  statesHook: ReactHook,
  beforeRequest(method) {
    method.config.headers = {
      ...method.config.headers,
      'X-App-Context': 'web',
    }
  },
  requestAdapter: adapterFetch({
    customFetch: (input: RequestInfo | URL, init?: RequestInit) =>
      fetch(input, { ...init, credentials: 'include' }),
  }),
  baseURL: API_BASE_URL,
  timeout: 30_000,
  shareRequest: true,
  cacheFor: {
    GET: 0,
    POST: 0,
    PUT: 0,
    DELETE: 0,
  },
})
