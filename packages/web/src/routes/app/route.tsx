import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { useAuthStore } from '@/stores/auth'

export const Route = createFileRoute('/app')({
  beforeLoad: async () => {
    // 统一从 Zustand persist store 读取 token，避免双重存储不一致
    const token = useAuthStore.getState().token
    if (!token) {
      throw redirect({ to: '/login' })
    }
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  return (
    <div className="flex h-screen bg-surface-2">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* TabBar 占位 — 具体实现在 f-35 (ChatView) */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
