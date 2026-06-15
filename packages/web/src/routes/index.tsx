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

    // 创建一个新的聊天标签，最后的 redirect 会负责统一导航，避免重复 navigate
    const tab = await tabManager.openNewChat({ skipNavigation: true })

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
