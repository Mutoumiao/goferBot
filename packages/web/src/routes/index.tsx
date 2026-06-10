import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth'

function waitForInit(maxMs = 2000): Promise<void> {
  return new Promise((resolve) => {
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
    const isAuthenticated = useAuthStore.getState().isAuthenticated
    if (isAuthenticated) {
      throw redirect({ to: '/app/chat' })
    }
    throw redirect({ to: '/login' })
  },
  component: IndexPage,
})

function IndexPage() {
  return null
}
