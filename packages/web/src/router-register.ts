import type { FileRoutesByFullPath } from '@/routeTree.gen'
import { MessageCircle, BookOpen, Clock, Settings, Trash2, User, type LucideIcon } from 'lucide-react'

type RoutePath = keyof FileRoutesByFullPath

export type RouteKey = 'login' | 'chat' | 'knowledgeBase' | 'history' | 'settings' | 'recycle' | 'profile'
export type TabRouteKey = Exclude<RouteKey, 'login'>

export interface RouteMeta {
  key: RouteKey
  title: string
  path: RoutePath
  singleton: boolean
  closable: boolean
  /** lucide-react 图标名，用于 Sidebar 导航项 */
  icon?: LucideIcon | null
  /** Sidebar 分区：'primary' 为主导航，'secondary' 为底部导航，不设置则不显示在 Sidebar */
  navSection?: 'primary' | 'secondary' | null
  bindTo?: (...args: string[]) => string
}

export const ROUTES_REGISTER = {
  login: {
    key: 'login',
    title: '登录',
    singleton: true,
    closable: false,
    path: '/login',
    icon: null,
    navSection: null,
  },
  chat: {
    key: 'chat',
    title: '会话页',
    singleton: true,
    closable: true,
    path: '/chat/$tabId',
    icon: MessageCircle,
    navSection: null,
    bindTo: (tabId: string) => `/chat/${tabId}`,
  },
  knowledgeBase: {
    key: 'knowledgeBase',
    title: '知识库',
    singleton: true,
    closable: true,
    path: '/knowledgeBase',
    icon: BookOpen,
    navSection: 'primary',
  },
  history: {
    key: 'history',
    title: '会话历史',
    singleton: true,
    closable: true,
    path: '/history',
    icon: Clock,
    navSection: 'primary',
  },
  settings: {
    key: 'settings',
    title: '设置',
    singleton: true,
    closable: true,
    path: '/settings',
    icon: Settings,
    navSection: 'secondary',
  },
  recycle: {
    key: 'recycle',
    title: '回收站',
    singleton: true,
    closable: true,
    path: '/recycle',
    icon: Trash2,
    navSection: 'secondary',
  },
  profile: {
    key: 'profile',
    title: '基础信息',
    singleton: true,
    closable: true,
    path: '/profile',
    icon: User,
    navSection: null,
  },
} as const satisfies Record<RouteKey, RouteMeta>

export function getRouteMeta(key: RouteKey): RouteMeta {
  return ROUTES_REGISTER[key]
}

export function getTabPath(tab: { type: TabRouteKey; id: string }): string {
  const meta = getRouteMeta(tab.type)
  return meta.bindTo ? meta.bindTo(tab.id) : meta.path
}
