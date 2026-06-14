import { createAlova } from 'alova'
import ReactHook from 'alova/react'
import adapterFetch from 'alova/fetch'
import { useAuthStore } from '@/stores/auth'
import { getRefreshToken, setAccessToken, setRefreshToken, buildAuthHeader } from '@/utils/auth-token'

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
    const json = await response.json() as { data?: { accessToken?: string; refreshToken?: string } }
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
  refreshSubscribers.forEach((cb) => cb(newToken))
  refreshSubscribers = []
}

function addSubscriber(cb: (token: string) => void) {
  refreshSubscribers.push(cb)
}

/** 处理 401/403：尝试刷新 token，失败则清空登录态 */
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
  // 已有刷新进行中，等刷新完成后用新 token 重试
  return new Promise<void>((resolve) => {
    addSubscriber((token: string) => {
      method.config.headers.Authorization = `Bearer ${token}`
      resolve(method.send() as unknown as void)
    })
  })
}

/** 检查 HTTP 响应状态，401/403 则触发刷新流程 */
function isUnauthorized(status: number) {
  return status === 401 || status === 403
}

const responded = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSuccess(response: Response, method: any) {
    if (isUnauthorized(response.status)) {
      return doRefreshAndRetry(method)
    }
    // 非 2xx 响应（除 401/403 外）视为错误，抛出异常
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    return response.json().then((json: Record<string, unknown>) => json.data ?? json)
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onError(error: { status?: number }, method: any) {
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
