import { useRef, useState, useEffect, useCallback } from 'react'
import { useRouter, useRouterState } from '@tanstack/react-router'
import { cn } from '@/utils/cn'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTabsStore } from '@/stores/tabs'
import { createChatSession } from '@/features/chat/services'
import type { Tab } from '@/stores/tabs'

export function TabBar({ className }: { className?: string }) {
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [hoveredTabId, setHoveredTabId] = useState<string | null>(null)

  // Tabs store
  const tabs = useTabsStore(s => s.tabs)
  const activeTabId = useTabsStore(s => s.activeTabId)
  const addTabByRoute = useTabsStore(s => s.addTabByRoute)
  const activateTab = useTabsStore(s => s.activateTab)
  const removeTab = useTabsStore(s => s.removeTab)

  // 路由同步：监听 href 变化，自动同步标签状态
  const href = useRouterState({ select: s => s.location.href })
  const pathname = useRouterState({ select: s => s.location.pathname })

  useEffect(() => {
    const searchStr = typeof window !== 'undefined' ? window.location.search : ''
    const currentPath = pathname + searchStr

    // 从路径中提取 sessionId（支持 /app/chat/:sessionId 格式）
    let sessionId: string | undefined
    const chatPathMatch = pathname.match(/^\/app\/chat\/(.+)$/)
    if (chatPathMatch) {
      sessionId = chatPathMatch[1]
    } else {
      // 兼容旧的 query 参数格式
      sessionId = new URLSearchParams(searchStr).get('session') || undefined
    }

    // 1. 先精确匹配路由
    const existing = useTabsStore.getState().findTabByRoute(currentPath)
    if (existing) {
      activateTab(existing.id)
      return
    }

    // 2. 对于 /app/chat（无路径参数），匹配 chat 类型的单页面标签（home tab）
    if (pathname === '/app/chat') {
      const homeTab = useTabsStore.getState().tabs.find(t => t.type === 'chat')
      if (homeTab) {
        activateTab(homeTab.id)
        return
      }
    }

    // 3. 对于 /app/chat/:sessionId，匹配同 sessionId 的 chat-session 标签
    if (sessionId) {
      const sessionTab = useTabsStore.getState().tabs.find(t => t.type === 'chat-session' && t.sessionId === sessionId)
      if (sessionTab) {
        activateTab(sessionTab.id)
        return
      }
    }

    // 4. 没有匹配到，创建新标签
    addTabByRoute(currentPath, undefined, sessionId)
  }, [href, pathname, activateTab, addTabByRoute])

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
      const newActiveId = removeTab(tabId)
      if (newActiveId) {
        const tab = useTabsStore.getState().tabs.find(t => t.id === newActiveId)
        if (tab) {
          router.navigate({ to: tab.route })
        }
      }
    },
    [removeTab, router]
  )

  // 新建标签 — 创建新会话
  const handleNewTab = useCallback(async () => {
    const newSession = await createChatSession()
    if (newSession?.id) {
      const route = `/app/chat/${newSession.id}`
      addTabByRoute(route, newSession.title || '新对话', newSession.id)
      router.navigate({ to: route })
    }
  }, [createChatSession, addTabByRoute, router])

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

          return (
            <div
              key={tab.id}
              data-active={isActive}
              className={cn(
                'group relative flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-[13px] transition-colors cursor-pointer select-none',
                isActive
                  ? 'bg-white text-[#1F2328] shadow-[0_1px_2px_rgba(0,0,0,0.03)] border border-[#E7EAF0]'
                  : 'bg-[#F0F2F5] text-[#5E6673] hover:bg-[#E8EAED] border border-transparent'
              )}
              onClick={() => handleTabClick(tab)}
              onMouseEnter={() => setHoveredTabId(tab.id)}
              onMouseLeave={() => setHoveredTabId(null)}
            >
              {/* 活跃标签的小圆点 */}
              {isActive && tab.type === 'chat-session' && (
                <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-[#5B7CFA]" />
              )}

              <span className="w-[120px] truncate">{tab.title}</span>

              {/* 关闭按钮 — 仅 hover 时显示，覆盖在文字上方 */}
              {tab.closable && (isActive || isHovered) && (
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
        className="h-8 w-8 shrink-0 rounded-md text-[#9AA3AF] hover:bg-[#E8EAED] hover:text-[#5E6673]"
        onClick={handleNewTab}
        title="新建问答会话"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  )
}
