import { createFileRoute } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth'

export const Route = createFileRoute('/app/')({
  component: AppHome,
})

function AppHome() {
  const user = useAuthStore((s) => s.user)

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-text-primary">
          欢迎回来{user?.name ? `，${user.name}` : ''}
        </h1>
        <p className="mt-2 text-text-secondary">
          选择一个对话开始吧
        </p>
      </div>
    </div>
  )
}
