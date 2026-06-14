import { useRef, useState, useEffect, useCallback } from 'react'
import { useRouter } from '@tanstack/react-router'
import { cn } from '@/utils/cn'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTabsStore } from '@/stores/tabs'
import type { Tab, RemoveTabResult } from '@/stores/tabs'

/** 创建临时聊天标签并导航到对应路由 */
function navigateToNewChatTab(router: ReturnType<typeof useRouter>) {
  const sessionId = crypto.randomUUID()
  useTabsStore.getState().addTempTab(sessionId)
  router.navigate({ to: '/chat/$sessionId', params: { sessionId } })
}

export function TabBar({ className }: { className?: string }) {
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [hoveredTabId, setHoveredTabId] = useState<string | null>(null)

  // Tabs store — 只读取状态和关闭操作
  const tabs = useTabsStore(s => s.tabs)
  const activeTabId = useTabsStore(s => s.activeTabId)
  const removeTab = useTabsStore(s => s.removeTab)

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

  // 点击标签 — 导航到对应路由
  const handleTabClick = useCallback(
    (tab: Tab) => {
      if (tab.id === activeTabId) return
      router.navigate({ to: tab.route })
    },
    [router, activeTabId]
  )

  // 关闭标签
  const handleTabClose = useCallback(
    (tabId: string) => {
      const result: RemoveTabResult = removeTab(tabId)
      switch (result.action) {
        case 'rejected':
          // 不允许关闭（只剩一个临时首页）
          break
        case 'navigate-new-temp':
          // 最后一个标签被关闭，导航到新临时首页
          navigateToNewChatTab(router)
          break
        case 'switch':
          // 切换到相邻标签
          const tab = useTabsStore.getState().tabs.find(t => t.id === result.targetId)
          if (tab) {
            router.navigate({ to: tab.route })
          }
          break
      }
    },
    [removeTab, router]
  )

  // 新建标签 — 生成临时ID并导航到临时首页
  const handleNewTab = useCallback(() => {
    navigateToNewChatTab(router)
  }, [router])

  return (
    <div className={cn('flex h-[52px] items-center gap-2 bg-surface-secondary px-3.5', className)}>
      {/* 标签滚动区域 */}
      <div
        ref={scrollRef}
        className="flex flex-1 items-center gap-2 overflow-x-auto scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {tabs.map(tab => {
          const isActive = tab.id === activeTabId
          const isHovered = tab.id === hoveredTabId
          const isChatSession = tab.sessionId != null
          // 只剩一个临时首页标签时不显示关闭按钮
          const canClose = tab.closable && !(tabs.length === 1 && tab.isTemp)

          return (
            <div
              key={tab.id}
              data-active={isActive}
              className={cn(
                'w-[150px] group relative flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-[13px] transition-colors cursor-pointer select-none',
                isActive
                  ? 'bg-surface-1 text-text-primary shadow-sm border border-border-default'
                  : 'bg-surface-3 text-text-secondary hover:bg-surface-2 border border-transparent'
              )}
              onClick={() => handleTabClick(tab)}
              onMouseEnter={() => setHoveredTabId(tab.id)}
              onMouseLeave={() => setHoveredTabId(null)}
            >
              {/* 活跃标签的小圆点 */}
              {isActive && isChatSession && <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-brand-blue" />}

              <span className="w-[120px] truncate">{tab.title}</span>

              {/* 关闭按钮 — 仅 hover 时显示，覆盖在文字上方 */}
              {canClose && (isActive || isHovered) && (
                <div className="absolute h-6 w-6 right-2 top-1/2 -translate-y-1/2 flex items-center justify-center">
                  <Button
                    variant="secondary"
                    className="h-4 w-4 rounded-sm text-text-secondary hover:text-black bg-transparent hover:bg-transparent"
                    onClick={e => {
                      e.stopPropagation()
                      handleTabClose(tab.id)
                    }}
                    aria-label={`关闭 ${tab.title}`}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 新建标签按钮 */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 rounded-md text-text-tertiary hover:bg-surface-2 hover:text-text-secondary"
        onClick={handleNewTab}
        title="新建问答会话"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  )
}
