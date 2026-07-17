/**
 * KeepAliveOutlet — 一级菜单整页缓存。
 * 仅由认证壳引用。
 *
 * 使用 React.lazy 避免 outlet ↔ 页面循环依赖。
 */
import { Outlet, useRouterState } from '@tanstack/react-router'
import {
  type ComponentType,
  type ReactNode,
  Suspense,
  lazy,
  useContext,
  useEffect,
  useMemo,
} from 'react'
import { cn } from '@/utils/cn'
import {
  KeepAliveControllerContext,
  KeepAliveRouteContext,
  type KeepAliveCacheKey,
  matchKeepAliveKey,
  type RouteFreeze,
} from './route-keepalive'

const KEEP_ALIVE_REGISTRY: Record<KeepAliveCacheKey, ComponentType> = {
  chats: lazy(() =>
    import('@/features/chat/components/ChatsPage').then((m) => ({ default: m.ChatsPage })),
  ),
  knowledgeBase: lazy(() =>
    import('@/features/KnowledgeBase/components/KnowledgeBasePage').then((m) => ({
      default: m.KnowledgeBasePage,
    })),
  ),
  companions: lazy(() =>
    import('@/features/companion/components/CompanionsWorkspace').then((m) => ({
      default: m.CompanionsWorkspace,
    })),
  ),
  settings: lazy(() =>
    import('@/features/settings/components/SettingsPage').then((m) => ({
      default: m.SettingsPage,
    })),
  ),
  recycle: lazy(() =>
    import('@/features/recycle/RecycleBinPage').then((m) => ({ default: m.RecycleBinPage })),
  ),
  profile: lazy(() =>
    import('@/features/auth/components/ProfilePage').then((m) => ({ default: m.ProfilePage })),
  ),
}

/**
 * 一级菜单预热缓存。
 * 不含 companions：业务列表接口只应在进入该页后请求；首次访问再 ensure 并保活。
 */
const PRIMARY_WARM_KEYS: KeepAliveCacheKey[] = [
  'chats',
  'knowledgeBase',
  'settings',
  'recycle',
]

function KeepAliveSlot({
  cacheKey,
  isActive,
  children,
}: {
  cacheKey: KeepAliveCacheKey
  isActive: boolean
  children: ReactNode
}) {
  const value = useMemo<RouteFreeze>(
    () => ({
      isActive,
      cacheKey,
    }),
    [isActive, cacheKey],
  )

  return (
    <KeepAliveRouteContext.Provider value={value}>
      <div
        className={cn(
          'h-full min-h-0',
          isActive ? 'relative z-10' : 'pointer-events-none invisible absolute inset-0 z-0',
        )}
        data-keepalive-key={cacheKey}
        data-keepalive-active={isActive ? 'true' : 'false'}
        aria-hidden={!isActive}
      >
        {children}
      </div>
    </KeepAliveRouteContext.Provider>
  )
}

function PageFallback() {
  return (
    <div
      className="flex h-full items-center justify-center text-sm text-text-secondary"
      data-testid="keepalive-fallback"
    >
      加载中…
    </div>
  )
}

export function KeepAliveOutlet() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const activeKey = matchKeepAliveKey(pathname)
  const controller = useContext(KeepAliveControllerContext)

  useEffect(() => {
    for (const key of PRIMARY_WARM_KEYS) {
      controller?.ensure(key)
    }
  }, [controller])

  useEffect(() => {
    if (activeKey) {
      controller?.ensure(activeKey)
    }
  }, [activeKey, controller])

  const keysToRender = useMemo(() => {
    const set = new Set<KeepAliveCacheKey>(controller?.keys ?? [])
    if (activeKey) set.add(activeKey)
    for (const k of PRIMARY_WARM_KEYS) set.add(k)
    return Array.from(set)
  }, [controller?.keys, activeKey])

  return (
    <div className="relative h-full min-h-0" data-testid="keepalive-outlet">
      {keysToRender.map((key) => {
        const Comp = KEEP_ALIVE_REGISTRY[key]
        if (!Comp) return null
        const isActive = key === activeKey
        return (
          <KeepAliveSlot key={key} cacheKey={key} isActive={isActive}>
            <Suspense fallback={<PageFallback />}>
              <Comp />
            </Suspense>
          </KeepAliveSlot>
        )
      })}
      {/* 业务白卡壳由 WorkspaceStage 统一提供；子路由仅填满内容区 */}
      {activeKey === null ? (
        <div className="h-full min-h-0 overflow-auto" data-testid="workspace-outlet">
          <Outlet />
        </div>
      ) : null}
    </div>
  )
}
