import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuthContainer } from '@/features/auth/components/AuthContainer'
import { ROUTES_REGISTER } from '@/router-register'
import { waitForAuthInit } from '@/utils/wait-for-init'

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    // 与受保护路由共用 waitForAuthInit（single-flight），避免再打一次 /auth/me
    const hasSession = await waitForAuthInit()
    if (hasSession) {
      throw redirect({ to: '/chats' })
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
