import { useEffect } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { useTabsStore } from '@/stores/tabs'
import type { RouteMeta } from '@/router-register'

function isRouteMeta(value: unknown): value is RouteMeta {
  return value !== null && typeof value === 'object' && 'title' in value && 'singleton' in value && 'closable' in value
}

/**
 * TabRouteSync — 路由驱动标签同步器
 *
 * 职责：监听 Router 状态变化，自动同步到 Tabs Store。
 * 不渲染任何 UI，应在 AppLayout 中挂载（与 TabBar 同级）。
 *
 * 流程：
 *   Router 变化 → TabRouteSync 提取 leaf match 信息 → syncRoute() → Tabs Store 更新
 */
export function TabRouteSync() {
  const matches = useRouterState({
    select: s => s.matches,
  })

  const syncRoute = useTabsStore(s => s.syncRoute)

  useEffect(() => {
    if (!matches.length) return

    const leaf = matches[matches.length - 1]
    if (!leaf) return

    const rawMeta = (leaf.staticData as { meta?: unknown } | undefined)?.meta

    syncRoute({
      pathname: leaf.pathname,
      params: leaf.params as Record<string, string>,
      tabMeta: isRouteMeta(rawMeta) ? rawMeta : null,
    })
  }, [matches, syncRoute])

  return null
}
