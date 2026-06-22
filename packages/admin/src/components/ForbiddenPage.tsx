import { Button, Result, App } from 'antd'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from '@tanstack/react-router'

export function ForbiddenPage() {
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const router = useRouter()
  const { message } = App.useApp()

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <Result
        status="403"
        title="403"
        subTitle="抱歉，您没有权限访问此页面。"
        extra={[
          <Button
            type="primary"
            key="home"
            onClick={() => {
              message.info('已返回首页')
              void router.navigate({ to: '/dashboard' })
            }}
          >
            返回首页
          </Button>,
          <Button
            key="logout"
            danger
            onClick={() => {
              clearAuth()
              void router.navigate({ to: '/login' })
            }}
          >
            退出登录
          </Button>,
        ]}
      />
    </div>
  )
}
