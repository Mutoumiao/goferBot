/**
 * 等待认证初始化完成
 * ponytail: 使用 Zustand subscribe 替代轮询，减少无效检查
 */
export function waitForAuthInit(maxMs = 2000): Promise<void> {
  return new Promise((resolve) => {
    // 动态导入避免循环依赖
    import('@/stores/auth').then(({ useAuthStore }) => {
      // ponytail: 如果已初始化，直接返回
      if (useAuthStore.getState().isInitialized) {
        resolve()
        return
      }

      const start = Date.now()
      // ponytail: 使用 subscribe 监听状态变化，避免轮询
      const unsubscribe = useAuthStore.subscribe((state) => {
        if (state.isInitialized) {
          unsubscribe()
          resolve()
        } else if (Date.now() - start > maxMs) {
          unsubscribe()
          resolve()
        }
      })

      // ponytail: 超时兜底
      setTimeout(() => {
        unsubscribe()
        resolve()
      }, maxMs)
    })
  })
}
