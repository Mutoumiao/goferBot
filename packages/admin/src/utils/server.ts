import { createAlova } from 'alova'
import adapterFetch from 'alova/fetch'
import ReactHook from 'alova/react'
import { useAuthStore } from '@/stores/auth'

let isRefreshing = false
let refreshSubscribers: Array<() => void> = []

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

async function refreshToken(): Promise<boolean> {
  if (isRefreshing) return false
  isRefreshing = true
  try {
    const response = await fetch(`${API_BASE_URL}/auth/admin/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Context': 'admin',
      },
      body: '{}',
    })
    return response.ok
  } finally {
    isRefreshing = false
  }
}

function onRefreshed() {
  for (const cb of refreshSubscribers) cb()
  refreshSubscribers = []
}

function addSubscriber(cb: () => void) {
  refreshSubscribers.push(cb)
}

async function doRefreshAndRetry(method: {
  send: () => unknown
  config: { headers: Record<string, string> }
}) {
  if (!isRefreshing) {
    isRefreshing = true
    try {
      const ok = await refreshToken()
      if (ok) {
        onRefreshed()
        return method.send()
      }
    } finally {
      isRefreshing = false
    }
    useAuthStore.getState().clearAuth()
    window.location.replace('/login')
    throw new Error('Auth refresh failed')
  }
  return new Promise<unknown>((resolve) => {
    addSubscriber(() => {
      resolve(method.send())
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
  onSuccess(
    response: Response,
    method: { send: () => unknown; config: { headers: Record<string, string> } },
  ) {
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
  onError(
    error: { status?: number },
    method: { send: () => unknown; config: { headers: Record<string, string> } },
  ): Promise<void> {
    const status = error.status
    if (status && isUnauthorized(status) && !isLoginPage()) {
      return doRefreshAndRetry(method) as Promise<void>
    }
    throw error
  },
}

export const alovaInstance = createAlova({
  responded,
  id: 'goferbot-admin',
  statesHook: ReactHook,
  beforeRequest(method) {
    method.config.headers = {
      ...method.config.headers,
      'X-App-Context': 'admin',
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
