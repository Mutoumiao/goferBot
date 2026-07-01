import { useRouter } from '@tanstack/react-router'
import { App, Button, Result } from 'antd'
import { logoutService } from '@/features/auth/services'

export function ForbiddenPage() {
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
            onClick={() => logoutService()}
          >
            退出登录
          </Button>,
        ]}
      />
    </div>
  )
}
