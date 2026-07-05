/**
 * 等待认证初始化完成
 * 先等 hydration，再调用 fetchMe 从服务器验证
 */
export function waitForAuthInit(maxMs = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    // 动态导入避免循环依赖
    import('@/stores/auth').then(({ useAuthStore }) => {
      if (useAuthStore.getState().isInitialized) {
        resolve(!!useAuthStore.getState().user)
        return
      }

      const unsubscribe = useAuthStore.subscribe((state) => {
        if (!state._hydrated) return

        unsubscribe()
        // hydration 完成，调用 fetchMe 从服务器验证
        useAuthStore.getState().fetchMe().then(resolve)
      })

      // 超时兜底
      setTimeout(() => {
        unsubscribe()
        // 超时后用现有 user 兜底
        resolve(!!useAuthStore.getState().user)
      }, maxMs)
    })
  })
}
