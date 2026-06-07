import { createAlova } from 'alova'
import ReactHook from 'alova/react'
import adapterFetch from 'alova/fetch'

// Token 刷新状态管理
let isRefreshing = false
let refreshSubscribers: Array<(token: string) => void> = []

async function refreshToken(): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!res.ok) throw new Error('refresh failed')
    const json = await res.json()
    const token = json.data?.accessToken
    if (token) localStorage.setItem('goferbot_access_token', token)
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
  baseURL: '/api',
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
      if (error.status === 401) {
        if (!isRefreshing) {
          isRefreshing = true
          const newToken = await refreshToken()
          isRefreshing = false
          if (newToken) {
            onRefreshed(newToken)
            return method.send()
          }
          // refresh 失败 → 清除状态 → 跳登录
          // TODO: 替换为 router.navigate() 避免整页重载丢失未保存状态
          // 需要将 TanStack Router 实例注入到 alova 模块（可能需要依赖注入或全局引用）
          localStorage.removeItem('goferbot_access_token')
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
