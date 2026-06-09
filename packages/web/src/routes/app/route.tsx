import { useEffect, useCallback } from 'react'
import { createFileRoute, Outlet, useRouter, useRouterState } from '@tanstack/react-router'
import { ConfigProvider } from '@/components/ConfigProvider'
import { TabBar } from '@/components/tab-bar/TabBar'
import { IconSidebar } from '@/components/sidebar/Sidebar'
import { useTabsStore } from '@/stores/tabs'
import { useChatStore } from '@/stores/chat'
import type { Tab } from '@/stores/tabs'

export const Route = createFileRoute('/app')({
  beforeLoad: async () => {
    // const token = useAuthStore.getState().token
    // if (!token) {
    //   throw redirect({ to: '/login' })
    // }
  },
  component: AppLayout,
})

function AppLayout() {
  const router = useRouter()

  // 用 useRouterState 选择器直接获取原始字符串值，避免 location 对象比较问题
  const pathname = useRouterState({
    select: s => s.location.pathname,
  })

  const tabs = useTabsStore(s => s.tabs)
  const activeTabId = useTabsStore(s => s.activeTabId)
  const addTabByRoute = useTabsStore(s => s.addTabByRoute)
  const activateTab = useTabsStore(s => s.activateTab)
  const removeTab = useTabsStore(s => s.removeTab)

  const createSession = useChatStore(s => s.createSession)

  // 用 href 作为 effect 触发器，确保 pathname 和 search 变化都能捕获
  const href = useRouterState({ select: (s) => s.location.href })

  useEffect(() => {
    const searchStr = typeof window !== 'undefined' ? window.location.search : ''
    const currentPath = pathname + searchStr
    const sessionId = new URLSearchParams(searchStr).get('session') || undefined

    const existing = useTabsStore.getState().findTabByRoute(currentPath)

    if (existing) {
      activateTab(existing.id)
    } else {
      addTabByRoute(currentPath, undefined, sessionId)
    }
  }, [href, pathname, activateTab, addTabByRoute])

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
    const newSession = await createSession()
    if (newSession?.id) {
      const route = `/app/chat?session=${newSession.id}`
      addTabByRoute(route, newSession.title || '新对话', newSession.id)
      router.navigate({ to: route })
    }
  }, [createSession, addTabByRoute, router])

  return (
    <ConfigProvider>
      <div className="flex h-screen bg-surface-2">
        <IconSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TabBar
            tabs={tabs}
            activeTabId={activeTabId}
            onTabClick={handleTabClick}
            onTabClose={handleTabClose}
            onNewTab={handleNewTab}
          />
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </ConfigProvider>
  )
}
