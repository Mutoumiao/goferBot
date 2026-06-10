import { createAlova } from 'alova'
import ReactHook from 'alova/react'
import adapterFetch from 'alova/fetch'

// Token 刷新状态管理
let isRefreshing = false
let refreshSubscribers: Array<(token: string) => void> = []

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

const refreshAlova = createAlova({
  statesHook: ReactHook,
  requestAdapter: adapterFetch(),
  baseURL: API_BASE_URL,
})

async function refreshToken(): Promise<string | null> {
  const refreshTokenValue = localStorage.getItem('goferbot_refresh_token')
  if (!refreshTokenValue) {
    return null
  }
  try {
    const res = await refreshAlova.Post<{ accessToken?: string; refreshToken?: string }>('/auth/refresh', {
      refreshToken: refreshTokenValue,
    }).send()
    const token = res.accessToken
    const newRefreshToken = res.refreshToken
    if (token) localStorage.setItem('goferbot_access_token', token)
    if (newRefreshToken) localStorage.setItem('goferbot_refresh_token', newRefreshToken)
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

export const alovaInstance = createAlova({
  id: 'goferbot',
  statesHook: ReactHook,
  requestAdapter: adapterFetch(),
  baseURL: API_BASE_URL,
  timeout: 30_000,
  shareRequest: true,
  cacheFor: {
    GET: 300_000,
    POST: 0,
    PUT: 0,
    DELETE: 0,
  },

  beforeRequest(method) {
    const token = localStorage.getItem('goferbot_access_token')
    if (token) {
      method.config.headers.Authorization = `Bearer ${token}`
    }
  },

  responded: {
    onSuccess: async (response) => {
      const json = await response.json()
      // NestJS ResponseInterceptor 包装格式: { data: T }
      // 解包 data 字段，使业务代码直接访问 res.accessToken 而非 res.data.accessToken
      return json.data ?? json
    },
    onError: async (error, method) => {
      if (error.status === 401 || error.status === 403) {
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
          // refresh 失败 → 清除状态 → 跳登录
          localStorage.removeItem('goferbot_access_token')
          localStorage.removeItem('goferbot_refresh_token')
          window.location.href = '/login'
          throw error
        }
        // 已有刷新进行中，加入队列等待
        return new Promise<void>((resolve) => {
          addSubscriber((newToken: string) => {
            method.config.headers.Authorization = `Bearer ${newToken}`
            resolve(method.send())
          })
        })
      }
      throw error
    },
  },
})
