import { createFileRoute, Outlet } from '@tanstack/react-router'
import { ConfigProvider } from '@/components/ConfigProvider'
import { TabBar } from '@/components/tab-bar/TabBar'
import { IconSidebar } from '@/components/sidebar/Sidebar'

export const Route = createFileRoute('/app')({
  beforeLoad: async () => {
    // const token = useAuthStore.getState().token
    // if (!token) {
    //   throw redirect({ to: '/login' })
    // }
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
