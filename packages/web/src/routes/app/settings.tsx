import { createFileRoute } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth'

export const Route = createFileRoute('/app/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)

  return (
    <div className="h-full p-6">
      <h1 className="text-xl font-bold text-text-primary">设置</h1>

      <div className="mt-6 space-y-6">
        {/* 用户信息 */}
        <section>
          <h2 className="text-sm font-medium text-text-secondary">个人信息</h2>
          <div className="mt-3 rounded-lg border border-border-default bg-surface-1 p-4">
            <div className="space-y-2 text-sm">
              <p><span className="text-text-secondary">用户名：</span><span className="text-text-primary">{user?.name ?? '—'}</span></p>
              <p><span className="text-text-secondary">邮箱：</span><span className="text-text-primary">{user?.email ?? '—'}</span></p>
            </div>
          </div>
        </section>

        {/* 操作 */}
        <section>
          <h2 className="text-sm font-medium text-text-secondary">账号操作</h2>
          <div className="mt-3 space-y-2">
            <button
              onClick={() => {
                clearAuth()
                localStorage.removeItem('goferbot_access_token')
                // TODO: 替换为 router.navigate() 避免整页重载
                // 需要将 TanStack Router 实例注入（与 server.ts 共用全局引用）
                window.location.href = '/login'
              }}
              className="rounded-md px-4 py-2 text-sm font-medium text-error hover:bg-surface-2"
            >
              退出登录
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
