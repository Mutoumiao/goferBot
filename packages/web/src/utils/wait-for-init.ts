/**
 * 等待认证初始化完成
 * 先等 hydration，再调用 fetchMe 从服务器验证
 */
export function waitForAuthInit(maxMs = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    import('@/stores/auth').then(({ useAuthStore }) => {
      if (useAuthStore.getState().isInitialized) {
        resolve(!!useAuthStore.getState().user)
        return
      }

      const unsubscribe = useAuthStore.subscribe((state) => {
        if (!state._hydrated) return

        unsubscribe()
        import('@/features/auth/services').then(({ fetchMe }) => {
          fetchMe().then(resolve)
        })
      })

      setTimeout(() => {
        unsubscribe()
        resolve(!!useAuthStore.getState().user)
      }, maxMs)
    })
  })
}
