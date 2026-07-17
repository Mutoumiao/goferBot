import {
  BookOpen,
  Heart,
  type LucideIcon,
  MessageCircle,
  Settings,
  Trash2,
} from 'lucide-react'
import type { FileRoutesByFullPath } from '@/routeTree.gen'

type RoutePath = keyof FileRoutesByFullPath | '/chats'

export type RouteKey =
  | 'login'
  | 'chats'
  | 'companion'
  | 'knowledgeBase'
  | 'settings'
  | 'recycle'
  | 'profile'

export interface RouteMeta {
  key: RouteKey
  title: string
  path: RoutePath | string
  /** 是否一级导航可 Keep-Alive 的页面 */
  keepAlive?: boolean
  /** lucide-react 图标，用于 Icon Rail */
  icon?: LucideIcon | null
  /** Icon Rail 分区：primary 主区，secondary 次区，null 不显示 */
  navSection?: 'primary' | 'secondary' | null
  /** 路由前缀匹配（用于 active 与 navigate） */
  matchPrefixes?: string[]
  bindTo?: (...args: string[]) => string
}

/** 路由元数据 + Icon Rail 配置（URL 真相源，无 Tab 工作区语义）。 */
export const ROUTES_REGISTER = {
  login: {
    key: 'login',
    title: '登录',
    path: '/login',
    icon: null,
    navSection: null,
  },
  chats: {
    key: 'chats',
    title: '会话',
    path: '/chats',
    icon: MessageCircle,
    navSection: 'primary',
    keepAlive: true,
    matchPrefixes: ['/chats'],
  },
  companion: {
    key: 'companion',
    title: 'AI 伴侣',
    path: '/companions',
    icon: Heart,
    navSection: 'primary',
    keepAlive: true,
    matchPrefixes: ['/companions'],
  },
  knowledgeBase: {
    key: 'knowledgeBase',
    title: '知识库',
    path: '/knowledgeBase',
    icon: BookOpen,
    navSection: 'primary',
    keepAlive: true,
    matchPrefixes: ['/knowledgeBase'],
  },
  settings: {
    key: 'settings',
    title: '设置',
    path: '/settings',
    icon: Settings,
    navSection: 'secondary',
    keepAlive: true,
    matchPrefixes: ['/settings'],
  },
  recycle: {
    key: 'recycle',
    title: '回收站',
    path: '/recycle',
    icon: Trash2,
    navSection: 'secondary',
    keepAlive: true,
    matchPrefixes: ['/recycle'],
  },
  profile: {
    key: 'profile',
    title: '个人资料',
    path: '/profile',
    /** 不进 Icon Rail：点顶栏头像进入 */
    icon: null,
    navSection: null,
    keepAlive: true,
    matchPrefixes: ['/profile'],
  },
} as const satisfies Record<RouteKey, RouteMeta>

export function getRouteMeta(key: RouteKey): RouteMeta {
  return ROUTES_REGISTER[key]
}

/** 判断 pathname 是否命中该路由的 active 前缀 */
export function isRouteActive(meta: RouteMeta, pathname: string): boolean {
  const prefixes = meta.matchPrefixes ?? [meta.path]
  return prefixes.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(`${p}?`),
  )
}
