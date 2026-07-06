import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuthContainer } from '@/features/auth/components/AuthContainer'
import { checkSession } from '@/features/auth/services'
import { ROUTES_REGISTER } from '@/router-register'
import { tabManager } from '@/stores/tabManager'

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    // 已有有效会话（Cookie 未过期）→ 自动跳转首页
    const hasSession = await checkSession()
    if (hasSession) {
      const tab = await tabManager.openRoute(ROUTES_REGISTER.chat.key, { skipNavigation: true })
      throw redirect({ to: ROUTES_REGISTER.chat.path, params: { tabId: tab.id } })
    }
  },
  component: LoginPage,
  staticData: {
    meta: ROUTES_REGISTER.login,
  },
})

function LoginPage() {
  return <AuthContainer />
}
