import { Link } from '@tanstack/react-router'
import { cn } from '@/utils/cn'

interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  return (
    <aside
      className={cn(
        'flex h-full w-60 flex-col border-r border-border-default bg-surface-1',
        className,
      )}
    >
      {/* Logo / Brand */}
      <div className="flex h-14 items-center border-b border-border-subtle px-4">
        <h2 className="text-lg font-semibold text-text-primary">GoferBot</h2>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3">
        <NavItem to="/app" icon="💬" label="聊天" />
        <NavItem to="/app/kb" icon="📚" label="知识库" />
        <NavItem to="/app/history" icon="🕐" label="历史" />
        <NavItem to="/app/settings" icon="⚙️" label="设置" />
        <NavItem to="/app/recycle-bin" icon="🗑️" label="回收站" />
      </nav>

      {/* User footer */}
      <div className="border-t border-border-subtle p-3">
        <div className="text-xs text-text-tertiary">GoferBot v0.1.0</div>
      </div>
    </aside>
  )
}

function NavItem({
  to,
  icon,
  label,
}: {
  to: string
  icon: string
  label: string
}) {
  return (
    <Link
      to={to}
      className={cn(
        'flex items-center gap-2 rounded-md px-3 py-2 text-sm',
        'text-text-secondary transition-colors',
        'hover:bg-surface-2 hover:text-text-primary',
      )}
    >
      <span className="text-base">{icon}</span>
      <span>{label}</span>
    </Link>
  )
}
