import { Avatar } from '@/features/auth/components/Avatar'
import { ROUTES_REGISTER, type TabRouteKey } from '@/router-register'
import { useAuthStore } from '@/stores/auth'
import { tabManager } from '@/stores/tabManager'
import { cn } from '@/utils/cn'

interface NavItem {
  key: TabRouteKey
  icon: React.ReactNode
  label: string
}

function useSidebarNav(): { primary: NavItem[]; secondary: NavItem[] } {
  const primary: NavItem[] = []
  const secondary: NavItem[] = []

  for (const [, meta] of Object.entries(ROUTES_REGISTER)) {
    if (!meta.icon || !meta.navSection) continue
    const item: NavItem = {
      key: meta.key as TabRouteKey,
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
  const user = useAuthStore((s) => s.user)
  const { primary, secondary } = useSidebarNav()

  const handleOpenProfile = () => {
    void tabManager.openRoute(ROUTES_REGISTER.profile.key)
  }

  const handleNavClick = (key: TabRouteKey) => {
    void tabManager.openRoute(key)
  }

  return (
    <aside className={cn('flex w-15 flex-col items-center bg-surface-secondary py-5', className)}>
      {/* 用户头像 */}
      <button
        type="button"
        className="mb-6 cursor-pointer transition-opacity hover:opacity-80"
        onClick={handleOpenProfile}
        title="个人资料"
      >
        <Avatar src={user?.avatar ?? undefined} fallback={user?.name ?? undefined} size={40} />
      </button>

      {/* 主导航图标 */}
      <nav className="flex flex-1 flex-col items-center gap-3">
        {primary.map(({ key, icon, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => handleNavClick(key)}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl text-text-primary transition-colors hover:bg-surface-3',
            )}
            title={label}
          >
            {icon}
          </button>
        ))}
      </nav>

      {/* 次级导航图标 */}
      <nav className="flex flex-col items-center gap-3">
        {secondary.map(({ key, icon, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => handleNavClick(key)}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl text-text-primary transition-colors hover:bg-surface-3',
            )}
            title={label}
          >
            {icon}
          </button>
        ))}
      </nav>
    </aside>
  )
}
