import { Link, useLocation } from '@tanstack/react-router'
import { cn } from '@/utils/cn'
import { MessageCircle, BookOpen, Clock, Settings, Trash2 } from 'lucide-react'

const navItems = [
  { to: '/app/chat', icon: MessageCircle, label: '聊天' },
  { to: '/app/kb', icon: BookOpen, label: '知识库' },
  { to: '/app/history', icon: Clock, label: '历史' },
  { to: '/app/settings', icon: Settings, label: '设置' },
  { to: '/app/recycle-bin', icon: Trash2, label: '回收站' },
]

export function IconSidebar({ className }: { className?: string }) {
  const location = useLocation()

  return (
    <aside
      className={cn(
        'flex w-[60px] flex-col items-center border-r border-border-default bg-surface-1 py-5',
        className,
      )}
    >
      {/* Logo */}
      <div className="mb-6 flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      </div>

      {/* 导航图标 */}
      <nav className="flex flex-1 flex-col items-center gap-3">
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname.startsWith(to)
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl transition-colors',
                isActive
                  ? 'bg-brand-primary/10 text-brand-primary'
                  : 'text-text-tertiary hover:bg-surface-2 hover:text-text-primary',
              )}
              title={label}
            >
              <Icon className="h-5 w-5" />
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
