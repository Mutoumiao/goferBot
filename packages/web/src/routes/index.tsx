import { createFileRoute, redirect } from '@tanstack/react-router'
import { ROUTES_REGISTER } from '@/router-register'
import { useAuthStore } from '@/stores/auth'
import { tabManager } from '@/stores/tabManager'
import { waitForAuthInit } from '@/utils/wait-for-init'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    await waitForAuthInit()
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
