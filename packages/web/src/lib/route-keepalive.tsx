/**
 * 一级路由 Keep-Alive 核心（上下文 / hooks）。
 *
 * 模型（本地应用式）：
 * - 一级菜单路径整页缓存，CSS 隐藏不卸载
 * - 页内选中态放 zustand，不写 URL search
 * - 切菜单只切换 activeKey
 *
 * 注意：本文件不得 import 任何页面组件（避免循环依赖导致运行时 undefined）。
 */
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

export type KeepAliveCacheKey =
  | 'chats'
  | 'knowledgeBase'
  | 'companions'
  | 'settings'
  | 'recycle'
  | 'profile'

export type KeepAliveApi = {
  destroy: (keys: string | string[]) => void
  destroyAll: () => void
  keys: string[]
}

export type RouteFreeze = {
  isActive: boolean
  cacheKey: KeepAliveCacheKey
}

export type KeepAliveController = {
  ensure: (key: KeepAliveCacheKey) => void
  remove: (keys: string | string[]) => void
  clear: () => void
  keys: KeepAliveCacheKey[]
}

export const KeepAliveReactContext = createContext<KeepAliveApi | null>(null)
export const KeepAliveRouteContext = createContext<RouteFreeze | null>(null)
export const KeepAliveControllerContext = createContext<KeepAliveController | null>(null)

/** 一级菜单保活映射；子路径返回 null → Outlet */
export function matchKeepAliveKey(pathname: string): KeepAliveCacheKey | null {
  if (pathname === '/chats') return 'chats'
  if (pathname === '/knowledgeBase') return 'knowledgeBase'
  if (pathname === '/recycle') return 'recycle'
  if (pathname === '/settings') return 'settings'
  if (pathname === '/profile') return 'profile'
  if (pathname === '/companions' || pathname === '/companions/') return 'companions'
  return null
}

export function KeepAliveProvider({ children }: { children: ReactNode }) {
  const [keys, setKeys] = useState<KeepAliveCacheKey[]>([])

  const ensure = useCallback((key: KeepAliveCacheKey) => {
    setKeys((prev) => (prev.includes(key) ? prev : [...prev, key]))
  }, [])

  const remove = useCallback((input: string | string[]) => {
    const list = Array.isArray(input) ? input : [input]
    setKeys((prev) => prev.filter((k) => !list.includes(k as KeepAliveCacheKey)))
  }, [])

  const clear = useCallback(() => {
    setKeys([])
    window.dispatchEvent(new Event('gofer-keepalive-destroy-all'))
  }, [])

  const api = useMemo<KeepAliveApi>(
    () => ({
      destroy: remove,
      destroyAll: clear,
      keys,
    }),
    [remove, clear, keys],
  )

  const controller = useMemo(
    () => ({ ensure, remove, clear, keys }),
    [ensure, remove, clear, keys],
  )

  return (
    <KeepAliveReactContext.Provider value={api}>
      <KeepAliveControllerContext.Provider value={controller}>
        {children}
      </KeepAliveControllerContext.Provider>
    </KeepAliveReactContext.Provider>
  )
}

export function useKeepAlive(): KeepAliveApi {
  const ctx = useContext(KeepAliveReactContext)
  if (!ctx) {
    return {
      destroy: () => {},
      destroyAll: () => {},
      keys: [],
    }
  }
  return ctx
}

/** 当前缓存页是否激活（非 keep-alive 树内恒为 true） */
export function useKeepAliveActive(): boolean {
  return useContext(KeepAliveRouteContext)?.isActive ?? true
}

export type KeepAliveRefreshOptions = {
  /**
   * true = 二次（或更多次）切回本页：应无感刷新（不整页 loading、不骨架）。
   * false = 首次进入本页：允许首屏 loading。
   */
  silent: boolean
}

/**
 * 保活页「变为激活」时触发数据刷新。
 *
 * 规则：
 * - 页面隐藏（isActive=false）时不请求
 * - 首次变为激活：onActivate({ silent: false })
 * - 离开后再进入：onActivate({ silent: true }) → 静默覆盖本地缓存
 * - 持续保持激活时不会重复触发（仅 false→true 边沿）
 *
 * 用法：一级 keep-alive 业务页统一用此 hook 拉列表/配置，禁止 mount-once 写死「再也不拉」。
 */
export function useKeepAliveSilentRefresh(
  onActivate: (opts: KeepAliveRefreshOptions) => void,
): boolean {
  const isActive = useKeepAliveActive()
  const hasActivatedOnceRef = useRef(false)
  const prevActiveRef = useRef(false)
  const onActivateRef = useRef(onActivate)
  onActivateRef.current = onActivate

  useEffect(() => {
    if (!isActive) {
      prevActiveRef.current = false
      return
    }
    // 已在激活态：忽略（避免无关 re-render 重复刷）
    if (prevActiveRef.current) return
    prevActiveRef.current = true

    const silent = hasActivatedOnceRef.current
    hasActivatedOnceRef.current = true
    onActivateRef.current({ silent })
  }, [isActive])

  return isActive
}

export function destroyAllKeepAliveCaches() {
  window.dispatchEvent(new Event('gofer-keepalive-destroy-all'))
}

/**
 * @deprecated 请改用 useKeepAliveSilentRefresh（二次进入无感刷新）。
 * 保留稳定实现，避免旧模块仍 import 时炸白屏。
 */
export function useActiveEffect(effect: () => void | (() => void), deps: unknown[] = []) {
  useEffect(() => {
    return effect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
