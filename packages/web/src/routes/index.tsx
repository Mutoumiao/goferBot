import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth'
import { useTabsStore } from '@/stores/tabs'

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
      throw redirect({ to: '/login' })
    }

    const sessionId = crypto.randomUUID()
    useTabsStore.getState().addTempTab(sessionId)

    throw redirect({
      to: '/chat/$sessionId',
      params: { sessionId },
    })
  },
  component: IndexPage,
})

function IndexPage() {
  return null
}
