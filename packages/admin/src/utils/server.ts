import { createAlova } from 'alova'
import adapterFetch from 'alova/fetch'
import ReactHook from 'alova/react'
import { useAuthStore } from '@/stores/auth'
import { buildAuthHeader, getRefreshToken, setAccessToken, setRefreshToken } from '@/utils/auth-token'

let isRefreshing = false
let refreshSubscribers: Array<(token: string) => void> = []

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

async function refreshToken(): Promise<string | null> {
  const refreshTokenValue = getRefreshToken()
  if (!refreshTokenValue) return null
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refreshTokenValue }),
    })
    if (!response.ok) return null
    const json = (await response.json()) as {
      data?: { accessToken?: string; refreshToken?: string }
    }
    const payload = json.data ?? json
    const token = (payload as { accessToken?: string }).accessToken
    const newRefreshToken = (payload as { refreshToken?: string }).refreshToken
    if (token) setAccessToken(token)
    if (newRefreshToken) setRefreshToken(newRefreshToken)
    return token ?? null
  } catch {
    return null
  }
}

function onRefreshed(newToken: string) {
  for (const cb of refreshSubscribers) cb(newToken)
  refreshSubscribers = []
}

function addSubscriber(cb: (token: string) => void) {
  refreshSubscribers.push(cb)
}

async function doRefreshAndRetry(method: { send: () => unknown; config: { headers: Record<string, string> } }) {
  if (!isRefreshing) {
    isRefreshing = true
    try {
      const newToken = await refreshToken()
      if (newToken) {
        onRefreshed(newToken)
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
    addSubscriber((token) => {
      method.config.headers.Authorization = `Bearer ${token}`
      resolve(method.send())
    })
  })
}

function isUnauthorized(status: number) {
  return status === 401 || status === 403
}

const responded = {
  onSuccess(response: Response, method: { send: () => unknown; config: { headers: Record<string, string> } }) {
    if (isUnauthorized(response.status)) {
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
  onError(error: { status?: number }, method: { send: () => unknown; config: { headers: Record<string, string> } }) {
    const status = error.status
    if (status && isUnauthorized(status)) {
      return doRefreshAndRetry(method) as Promise<void>
    }
    throw error
  },
}

export const alovaInstance = createAlova({
  responded,
  id: 'goferbot-admin',
  statesHook: ReactHook,
  requestAdapter: adapterFetch(),
  baseURL: API_BASE_URL,
  timeout: 30_000,
  shareRequest: true,
  cacheFor: {
    GET: 0,
    POST: 0,
    PUT: 0,
    DELETE: 0,
  },
  beforeRequest(method) {
    const authHeader = buildAuthHeader()
    if (authHeader) {
      method.config.headers.Authorization = authHeader
    }
  },
})
