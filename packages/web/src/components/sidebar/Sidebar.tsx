import { Link, useRouter } from '@tanstack/react-router'
import { cn } from '@/utils/cn'
import { MessageCircle, BookOpen, Clock, Settings, Trash2 } from 'lucide-react'
import { Avatar } from '@/features/auth/components/Avatar'
import { useAuthStore } from '@/stores/auth'

const primaryNavItems = [
  { to: '/app/chat', icon: MessageCircle, label: '聊天' },
  { to: '/app/kb', icon: BookOpen, label: '知识库' },
  { to: '/app/history', icon: Clock, label: '历史' },
]

const secondaryNavItems = [
  { to: '/app/settings', icon: Settings, label: '设置' },
  { to: '/app/recycle-bin', icon: Trash2, label: '回收站' },
]

export function IconSidebar({ className }: { className?: string }) {
  const user = useAuthStore((s) => s.user)
  const router = useRouter()

  const handleOpenProfile = () => {
    router.navigate({ to: '/app/profile' })
  }

  return (
    <aside className={cn('flex w-[60px] flex-col items-center bg-surface-secondary py-5', className)}>
      {/* 用户头像 */}
      <button
        type="button"
        className="mb-6 cursor-pointer transition-opacity hover:opacity-80"
        onClick={handleOpenProfile}
        title="个人资料"
      >
        <Avatar src={user?.avatarUrl} fallback={user?.name} size={40} />
      </button>

      {/* 主导航图标 */}
      <nav className="flex flex-1 flex-col items-center gap-3">
        {primaryNavItems.map(({ to, icon: Icon, label }) => (
          <Link
            key={to}
            to={to}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl text-[#1F2328] transition-colors hover:bg-[#D1D5DB]'
            )}
            title={label}
          >
            <Icon className="h-5 w-5" />
          </Link>
        ))}
      </nav>

      {/* 次级导航图标 — 设置和回收站 */}
      <nav className="flex flex-col items-center gap-3">
        {secondaryNavItems.map(({ to, icon: Icon, label }) => (
          <Link
            key={to}
            to={to}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl text-[#1F2328] transition-colors hover:bg-[#D1D5DB]'
            )}
            title={label}
          >
            <Icon className="h-5 w-5" />
          </Link>
        ))}
      </nav>
    </aside>
  )
}
