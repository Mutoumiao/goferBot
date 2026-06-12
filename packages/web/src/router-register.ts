import type { FileRoutesByFullPath, } from '@/routeTree.gen'
import { MessageCircle, MessageCircleCodeIcon, BookOpen, Clock, Settings, Trash2, User, type LucideIcon } from 'lucide-react'

type RoutePath = keyof FileRoutesByFullPath

export interface RouteMeta {
  key: string
  title: string
  path: RoutePath
  singleton: boolean
  closable: boolean
  /** lucide-react 图标名，用于 Sidebar 导航项（如 "MessageCircle"） */
  icon?: LucideIcon | null
  /** Sidebar 分区：'primary' 为主导航，'secondary' 为底部导航，不设置则不显示在 Sidebar */
  navSection?: 'primary' | 'secondary' | null
  bindTo?: (...args: any[string]) => string
}

export const ROUTES_REGISTER: Record<string, RouteMeta> = {
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
    closable: false,
    path: '/chat',
    icon: MessageCircle,
    navSection: 'primary',
  },
  knowledgeBase: {
    key: 'knowledgeBase',
    title: '知识库',
    singleton: true,
    closable: false,
    path: '/knowledgeBase',
    icon: BookOpen,
    navSection: 'primary',
  },
  history: {
    key: 'history',
    title: '历史记录',
    singleton: true,
    closable: false,
    path: '/history',
    icon: Clock,
    navSection: 'primary',
  },
  settings: {
    key: 'settings',
    title: '设置',
    singleton: true,
    closable: false,
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
    closable: false,
    path: '/profile',
    icon: User,
    navSection: null,
  },
  session: {
    key: 'session',
    title: '会话页',
    singleton: true,
    closable: false,
    path: '/chat/$sessionId',
    icon: MessageCircleCodeIcon,
    navSection: null,
    bindTo: (sessionId) => `/chat/${sessionId}`,
  },
} as const
