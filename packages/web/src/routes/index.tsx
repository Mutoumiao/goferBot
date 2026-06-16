import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth'
import { tabManager } from '@/stores/tabManager'
import { ROUTES_REGISTER } from '@/router-register'

function waitForInit(maxMs = 2000): Promise<void> {
  return new Promise(resolve => {
    const start = Date.now()
    const check = () => {
      if (useAuthStore.getState().isInitialized) {
        resolve()
        return
      }
      if (Date.now() - start > maxMs) {
        resolve()
        return
      }
      setTimeout(check, 50)
    }
    check()
  })
}

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    await waitForInit()
    if (!useAuthStore.getState().isAuthenticated) {
      throw redirect({ to: ROUTES_REGISTER.login.path })
    }

    // 进入首页时优先复用已有空白 chat 标签，避免每次刷新都新建
    const tab = await tabManager.openRoute(ROUTES_REGISTER.chat.key, { skipNavigation: true })

    throw redirect({
      to: ROUTES_REGISTER.chat.path,
      params: { tabId: tab.id },
    })
  },
  component: IndexPage,
})

function IndexPage() {
  return null
}
