import { useEffect } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { useWorkspaceStore } from '@/stores/workspace.store'
import { getTabPath } from '@/router-register'

/**
 * TabRouteSync — 只读路由同步守护
 *
 * 职责：监听 Router 状态变化，仅在浏览器前进/后退导致 URL 与当前 activeTabId 不匹配时，
 * 同步 workspace 的 activeTabId。不创建新标签。
 */
export function TabRouteSync() {
  const matches = useRouterState({
    select: (s) => s.matches,
  })

  const activeTabId = useWorkspaceStore((s) => s.activeTabId)
  const tabs = useWorkspaceStore((s) => s.tabs)
  const switchTab = useWorkspaceStore((s) => s.switchTab)

  useEffect(() => {
    if (!matches.length) return

    const leaf = matches[matches.length - 1]
    if (!leaf) return

    const pathname = leaf.pathname
    const targetTab = tabs.find((t) => pathname === getTabPath(t))

    if (targetTab && targetTab.id !== activeTabId) {
      switchTab(targetTab.id)
    }
  }, [matches, tabs, activeTabId, switchTab])

  return null
}
