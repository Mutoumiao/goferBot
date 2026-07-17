/**
 * 等待认证初始化完成
 * 先等 Zustand persist hydration，再 single-flight 调用 fetchMe 验证会话
 *
 * 设计要点：
 * - 以 isAuthenticated 为信任标记（不持久化）；localStorage 的 user 仅作缓存
 * - 超时强制 isInitialized，避免白屏；超时视为未认证
 * - 后端不可达/网络错误时只初始化一次，禁止反复请求 /auth/me
 * - 模块级 single-flight：多个 beforeLoad / AuthInitializer 共享同一 Promise
 */

let _waitAuthInitPromise: Promise<boolean> | null = null

export function waitForAuthInit(maxMs = 3000): Promise<boolean> {
  if (_waitAuthInitPromise) return _waitAuthInitPromise

  _waitAuthInitPromise = runWaitForAuthInit(maxMs).finally(() => {
    _waitAuthInitPromise = null
  })

  return _waitAuthInitPromise
}

async function runWaitForAuthInit(maxMs: number): Promise<boolean> {
  const start = Date.now()

  const { useAuthStore } = await import('@/stores/auth')

  // 快路径：已初始化则直接返回当前认证态
  if (useAuthStore.getState().isInitialized) {
    return useAuthStore.getState().isAuthenticated
  }

  // 等待 hydration（轮询），超时则强制结束
  while (!useAuthStore.getState()._hydrated) {
    if (Date.now() - start > maxMs) {
      useAuthStore.getState().setInitialized(true)
      return false
    }
    await new Promise((r) => setTimeout(r, 50))
  }

  // 等 hydration 期间可能已被其他路径初始化
  if (useAuthStore.getState().isInitialized) {
    return useAuthStore.getState().isAuthenticated
  }

  const remaining = Math.max(0, maxMs - (Date.now() - start))
  const { fetchMe, invalidatePendingFetchMe } = await import('@/features/auth/services')

  let settled = false

  const timeoutPromise = new Promise<boolean>((resolve) => {
    setTimeout(() => {
      if (settled) return
      settled = true
      // 作废仍在飞行的 me，防止超时后晚到 setUser 把登录态拉回 true
      invalidatePendingFetchMe()
      const s = useAuthStore.getState()
      if (!s.isInitialized) {
        s.setInitialized(true)
      }
      resolve(false)
    }, remaining)
  })

  const mePromise = (async (): Promise<boolean> => {
    try {
      const ok = await fetchMe()
      if (settled) return false
      settled = true
      return ok
    } catch {
      if (settled) return false
      settled = true
      const s = useAuthStore.getState()
      if (!s.isInitialized) {
        s.setInitialized(true)
      }
      return false
    }
  })()

  return Promise.race([mePromise, timeoutPromise])
}
