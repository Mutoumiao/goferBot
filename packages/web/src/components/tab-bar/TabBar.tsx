import { useRef, useState, useEffect } from 'react'
import { cn } from '@/utils/cn'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Tab } from '@/stores/tabs'

interface TabBarProps {
  tabs: Tab[]
  activeTabId: string
  onTabClick: (tab: Tab) => void
  onTabClose: (tabId: string) => void
  onNewTab: () => void
  className?: string
}

export function TabBar({
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
  onNewTab,
  className,
}: TabBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [hoveredTabId, setHoveredTabId] = useState<string | null>(null)

  // active tab 变化时自动滚动到可视区域
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    const activeEl = container.querySelector('[data-active="true"]') as HTMLElement | null
    if (!activeEl) return

    const containerRect = container.getBoundingClientRect()
    const elRect = activeEl.getBoundingClientRect()

    if (elRect.left < containerRect.left) {
      container.scrollLeft -= containerRect.left - elRect.left + 8
    } else if (elRect.right > containerRect.right) {
      container.scrollLeft += elRect.right - containerRect.right + 8
    }
  }, [activeTabId])

  return (
    <div
      className={cn(
        'flex h-[52px] items-center gap-2 bg-[#F0F1F5] px-3.5',
        className,
      )}
    >
      {/* 标签滚动区域 */}
      <div
        ref={scrollRef}
        className="flex flex-1 items-center gap-2 overflow-x-auto scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId
          const isHovered = tab.id === hoveredTabId
          const showClose = tab.closable && (isActive || isHovered)

          return (
            <div
              key={tab.id}
              data-active={isActive}
              className={cn(
                'group flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-[13px] transition-colors cursor-pointer select-none',
                isActive
                  ? 'bg-white text-[#1F2328] shadow-[0_1px_2px_rgba(0,0,0,0.03)] border border-[#E7EAF0]'
                  : 'bg-[#F0F2F5] text-[#5E6673] hover:bg-[#E8EAED] border border-transparent',
              )}
              onClick={() => onTabClick(tab)}
              onMouseEnter={() => setHoveredTabId(tab.id)}
              onMouseLeave={() => setHoveredTabId(null)}
            >
              {/* 活跃标签的小圆点 */}
              {isActive && tab.type === 'chat-session' && (
                <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-[#5B7CFA]" />
              )}

              <span className="max-w-[160px] truncate">{tab.title}</span>

              {/* 关闭按钮 */}
              {showClose && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="ml-0.5 h-4 w-4 rounded-sm text-[#9AA3AF] hover:bg-[#E7EAF0] hover:text-[#5E6673]"
                  onClick={(e) => {
                    e.stopPropagation()
                    onTabClose(tab.id)
                  }}
                  aria-label={`关闭 ${tab.title}`}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          )
        })}
      </div>

      {/* 新建标签按钮 */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 rounded-md text-[#9AA3AF] hover:bg-[#E8EAED] hover:text-[#5E6673]"
        onClick={onNewTab}
        title="新建问答会话"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  )
}
