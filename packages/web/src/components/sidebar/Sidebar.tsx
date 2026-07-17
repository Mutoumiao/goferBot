import { useNavigate, useRouterState } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import { Avatar } from '@/features/auth/components/Avatar'
import { isRouteActive, ROUTES_REGISTER, type RouteKey, type RouteMeta } from '@/router-register'
import { useAuthStore } from '@/stores/auth'
import { cn } from '@/utils/cn'

interface NavItem {
  key: RouteKey
  meta?: RouteMeta
  Icon: LucideIcon
  label: string
  to?: string
}

function buildNavItems(section: 'primary' | 'secondary', order: RouteKey[]): NavItem[] {
  const items: NavItem[] = []
  for (const meta of Object.values(ROUTES_REGISTER)) {
    if (!meta.icon || meta.navSection !== section) continue
    items.push({
      key: meta.key,
      meta,
      Icon: meta.icon,
      label: meta.title,
      to: meta.path,
    })
  }
  items.sort((a, b) => {
    const ak = a.key as RouteKey
    const bk = b.key as RouteKey
    return order.indexOf(ak) - order.indexOf(bk)
  })
  return items
}

/** 主区 3 入口：会话 / 知识库 / 伴侣（个人资料走顶栏头像） */
const PRIMARY_NAV = buildNavItems('primary', ['chats', 'knowledgeBase', 'companion'])
/** 底区：设置 / 回收站（+ 菜单按钮） */
const SECONDARY_NAV = buildNavItems('secondary', ['settings', 'recycle'])

function RailButton({
  item,
  active,
  onClick,
}: {
  item: NavItem
  active: boolean
  onClick: () => void
}) {
  const { Icon } = item
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-11 w-11 items-center justify-center rounded-lg transition-colors duration-150',
        active
          ? 'bg-rail-active text-rail-fg-active ring-1 ring-brand-blue/25'
          : 'text-rail-fg hover:bg-rail-hover hover:text-text-primary',
      )}
      title={item.label}
      aria-label={item.label}
      aria-current={active ? 'page' : undefined}
      data-active={active ? 'true' : undefined}
      data-testid={`rail-${item.key}`}
    >
      <Icon className={cn('h-5 w-5', active && 'stroke-[2.25]')} />
    </button>
  )
}

/**
 * 70px 极简图标导航：
 * 顶 44 头像（个人资料）· 主区 3 入口 · Spacer · 底区设置/回收/菜单
 */
export function IconSidebar({ className }: { className?: string }) {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const profileActive = isRouteActive(ROUTES_REGISTER.profile, pathname)

  const handleOpenProfile = () => {
    if (profileActive) return
    void navigate({ to: '/profile' })
  }

  const handleNavClick = (item: NavItem) => {
    if (!item.to || !item.meta) return
    if (isRouteActive(item.meta, pathname)) return
    void navigate({ to: item.to })
  }

  const brandLetter = (user?.name?.trim()?.[0] || 'Y').toUpperCase()

  return (
    <aside
      className={cn(
        /* 与右侧舞台同色连续底，无描边，避免与白卡「双栏感」冲突 */
        'flex w-[70px] shrink-0 flex-col items-center bg-rail py-4',
        className,
      )}
      data-testid="icon-rail"
    >
      <button
        type="button"
        className={cn(
          'gofer-brand-gradient mb-5 flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-[15px] font-bold text-white gofer-soft-shadow transition-opacity hover:opacity-95',
          profileActive && 'ring-2 ring-brand-blue/40 ring-offset-2 ring-offset-rail',
        )}
        onClick={handleOpenProfile}
        title="个人资料"
        aria-label="个人资料"
        aria-current={profileActive ? 'page' : undefined}
        data-testid="rail-avatar"
        data-active={profileActive ? 'true' : undefined}
      >
        {user?.avatar ? (
          <Avatar
            src={user.avatar}
            fallback={user.name ?? undefined}
            size={44}
            className="rounded-lg"
          />
        ) : (
          brandLetter
        )}
      </button>

      <nav className="flex flex-col items-center gap-2" aria-label="主导航">
        {PRIMARY_NAV.map((item) => (
          <RailButton
            key={item.key}
            item={item}
            active={item.meta ? isRouteActive(item.meta, pathname) : false}
            onClick={() => handleNavClick(item)}
          />
        ))}
      </nav>

      <div className="min-h-4 flex-1" aria-hidden />

      <nav className="flex flex-col items-center gap-2" aria-label="次级导航">
        {SECONDARY_NAV.map((item) => (
          <RailButton
            key={item.key}
            item={item}
            active={item.meta ? isRouteActive(item.meta, pathname) : false}
            onClick={() => handleNavClick(item)}
          />
        ))}
      </nav>
    </aside>
  )
}
