import { createFileRoute, redirect } from '@tanstack/react-router'
import { ROUTES_REGISTER } from '@/router-register'
import { useAuthStore } from '@/stores/auth'
import { waitForAuthInit } from '@/utils/wait-for-init'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const authed = await waitForAuthInit()
    if (!authed || !useAuthStore.getState().isAuthenticated) {
      throw redirect({ to: ROUTES_REGISTER.login.path })
    }
    throw redirect({ to: '/chats' })
  },
  component: IndexPage,
})

function IndexPage() {
  return null
}
