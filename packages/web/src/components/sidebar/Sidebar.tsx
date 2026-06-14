import { Link, useRouter } from '@tanstack/react-router'
import { cn } from '@/utils/cn'
import { Avatar } from '@/features/auth/components/Avatar'
import { useAuthStore } from '@/stores/auth'
import { ROUTES_REGISTER } from '@/router-register'

interface NavItem {
  to: string
  icon: React.ReactNode
  label: string
}

function useSidebarNav(): { primary: NavItem[]; secondary: NavItem[] } {
  const entries = Object.entries(ROUTES_REGISTER).map(([, meta]) => ({ meta, fullPath: meta.path }))

  const primary: NavItem[] = []
  const secondary: NavItem[] = []

  for (const { meta, fullPath } of entries) {
    if (!meta?.icon || !meta.navSection) continue

    const item: NavItem = {
      to: fullPath,
      icon: <meta.icon className="h-5 w-5" />,
      label: meta.title,
    }

    if (meta.navSection === 'primary') {
      primary.push(item)
    } else {
      secondary.push(item)
    }
  }

  return { primary, secondary }
}

export function IconSidebar({ className }: { className?: string }) {
  const user = useAuthStore(s => s.user)
  const router = useRouter()
  const { primary, secondary } = useSidebarNav()

  const handleOpenProfile = () => {
    router.navigate({ to: ROUTES_REGISTER.profile.path })
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

      {/* 主导航图标 — 从路由 meta 动态生成 */}
      <nav className="flex flex-1 flex-col items-center gap-3">
        {primary.map(({ to, icon, label }) => (
          <Link
            key={to}
            to={to}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl text-[#1F2328] transition-colors hover:bg-[#D1D5DB]'
            )}
            title={label}
          >
            {icon}
          </Link>
        ))}
      </nav>

      {/* 次级导航图标 — 从路由 meta 动态生成 */}
      <nav className="flex flex-col items-center gap-3">
        {secondary.map(({ to, icon, label }) => (
          <Link
            key={to}
            to={to}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl text-[#1F2328] transition-colors hover:bg-[#D1D5DB]'
            )}
            title={label}
          >
            {icon}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
