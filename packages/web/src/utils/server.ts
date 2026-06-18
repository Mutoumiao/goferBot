import { createAlova } from 'alova'
import adapterFetch from 'alova/fetch'
import ReactHook from 'alova/react'
import { useAuthStore } from '@/stores/auth'
import {
  buildAuthHeader,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from '@/utils/auth-token'

// Token 刷新状态管理
let isRefreshing = false
let refreshSubscribers: Array<(token: string) => void> = []

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

async function refreshToken(): Promise<string | null> {
  const refreshTokenValue = getRefreshToken()
  if (!refreshTokenValue) return null
  try {
    // 直接使用 fetch 避免 alova 的 responded 链处理
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refreshTokenValue }),
    })
    if (!response.ok) return null
    const json = (await response.json()) as {
      data?: { accessToken?: string; refreshToken?: string }
    }
    // 解包 NestJS ResponseInterceptor: { data: T }
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

/** 处理 401/403：尝试刷新 token，失败则清空登录态 */
interface AlovaMethod {
  send: () => unknown
  config: { headers: Record<string, string> }
}

async function doRefreshAndRetry(method: AlovaMethod) {
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
  // 已有刷新进行中，等刷新完成后用新 token 重试
  return new Promise<void>((resolve) => {
    addSubscriber((token: string) => {
      method.config.headers.Authorization = `Bearer ${token}`
      resolve(method.send() as unknown as undefined)
    })
  })
}

/** 检查 HTTP 响应状态，401/403 则触发刷新流程 */
function isUnauthorized(status: number) {
  return status === 401 || status === 403
}

const responded = {
  onSuccess(response: Response, method: AlovaMethod) {
    if (isUnauthorized(response.status)) {
      return doRefreshAndRetry(method)
    }
    if (!response.ok) {
      // 保留 NestJS 异常体中的 { code, message } 结构，使上层 mapAuthError 能解析出中文提示
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
    if (error.status && isUnauthorized(error.status)) {
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
