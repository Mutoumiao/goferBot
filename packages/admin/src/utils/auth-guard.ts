import { useAuthStore } from '@/stores/auth'

/**
 * 等待 auth store 持久化 hydration 完成。
 * 因 zustand persist hydration 是异步的，在路由守卫或根组件中需先等待，
 * 避免在 hydration 完成前误判为未登录。
 */
export function waitForAuthInit(maxMs = 3000): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now()
    const check = () => {
      const state = useAuthStore.getState()
      if (state._hydrated && state.isInitialized) {
        resolve()
        return
      }
      if (Date.now() - start > maxMs) {
        useAuthStore.getState().setInitialized(true)
        resolve()
        return
      }
      setTimeout(check, 50)
    }
    check()
  })
}

export interface AuthStateSnapshot {
  isAuthenticated: boolean
  role: string | null
}

export function getAuthSnapshot(): AuthStateSnapshot {
  const s = useAuthStore.getState()
  return { isAuthenticated: s.isAuthenticated, role: s.user?.role ?? null }
}

export function isAdmin(snapshot: AuthStateSnapshot) {
  return snapshot.role === 'ADMIN' && snapshot.isAuthenticated
}

/**
 * 构建跳转到登录页时的 search 参数（用于登录成功后回跳原地址）。
 *
 * 注意：TanStack 的 `location.search` 是解析后的对象（可能是 null 原型），
 * 直接字符串拼接会抛 `TypeError: Cannot convert object to primitive value`。
 * 这里使用 `location.href`——它本身就是 `pathname + searchStr + hash` 的完整字符串。
 */
export function buildLoginRedirectSearch(location: {
  href: string
}): { redirect: string } | undefined {
  return location.href !== '/login' ? { redirect: location.href } : undefined
}
