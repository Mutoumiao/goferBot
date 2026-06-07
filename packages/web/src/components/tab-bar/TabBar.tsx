'use client'

import { cn } from '@/utils/cn'

interface Tab {
  id: string
  label: string
  href?: string
  onClose?: () => void
}

interface TabBarProps {
  tabs: Tab[]
  activeTab?: string
  onTabClick?: (tab: Tab) => void
  onTabClose?: (tab: Tab) => void
  className?: string
}

/**
 * TabBar — 顶部标签栏，用于会话/文档切换
 *
 * 在完整聊天功能实现前作为占位组件存在。
 * f-35 (ChatView) 将填充实际会话切换逻辑。
 */
export function TabBar({
  tabs,
  activeTab,
  onTabClick,
  onTabClose,
  className,
}: TabBarProps) {
  if (tabs.length === 0) return null

  return (
    <div
      className={cn(
        'flex h-10 items-center gap-1 border-b border-border-default bg-surface-1 px-2',
        className,
      )}
    >
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={cn(
            'flex items-center gap-1 rounded-t-md px-3 py-1 text-sm',
            'cursor-pointer transition-colors',
            activeTab === tab.id
              ? 'bg-surface-2 text-text-primary'
              : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary',
          )}
          onClick={() => onTabClick?.(tab)}
        >
          <span className="max-w-[120px] truncate">{tab.label}</span>
          {onTabClose && (
            <button
              className="ml-1 rounded-sm p-0.5 text-text-tertiary hover:text-error"
              onClick={(e) => {
                e.stopPropagation()
                onTabClose(tab)
              }}
              aria-label={`关闭 ${tab.label}`}
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
