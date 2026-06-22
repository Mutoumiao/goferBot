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
        state.setInitialized(true)
        resolve()
        return
      }
      setTimeout(check, 50)
    }
    check()
  })
}

export interface AuthStateSnapshot {
  token: string | null
  role: string | null
}

export function getAuthSnapshot(): AuthStateSnapshot {
  const s = useAuthStore.getState()
  return { token: s.token, role: s.user?.role ?? null }
}

export function isAdmin(snapshot: AuthStateSnapshot) {
  return snapshot.role === 'ADMIN' && !!snapshot.token
}
