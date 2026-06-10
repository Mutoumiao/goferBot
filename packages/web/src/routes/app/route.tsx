import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { ConfigProvider } from '@/components/ConfigProvider'
import { TabBar } from '@/components/tab-bar/TabBar'
import { IconSidebar } from '@/components/sidebar/Sidebar'
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

export const Route = createFileRoute('/app')({
  beforeLoad: async () => {
    await waitForInit()
    const token = useAuthStore.getState().token
    if (!token) {
      throw redirect({ to: '/login' })
    }
  },
  component: AppLayout,
})

function AppLayout() {
  return (
    <ConfigProvider>
      <div className="flex h-screen bg-surface-2">
        <IconSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TabBar />
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </ConfigProvider>
  )
}
