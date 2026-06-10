import { createFileRoute } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export const Route = createFileRoute('/app/settings')({
  component: SettingsPage,
  staticData: {
    tabMeta: {
      title: '设置',
      singleton: true,
      closable: true,
    },
  },
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
          <Card className="mt-3">
            <CardContent className="space-y-2 text-sm pt-6">
              <p><span className="text-text-secondary">用户名：</span><span className="text-text-primary">{user?.name ?? '—'}</span></p>
              <p><span className="text-text-secondary">邮箱：</span><span className="text-text-primary">{user?.email ?? '—'}</span></p>
            </CardContent>
          </Card>
        </section>

        {/* 操作 */}
        <section>
          <h2 className="text-sm font-medium text-text-secondary">账号操作</h2>
          <div className="mt-3">
            <Button
              variant="destructive"
              onClick={() => {
                clearAuth()
                localStorage.removeItem('goferbot_access_token')
                window.location.href = '/login'
              }}
            >
              退出登录
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
