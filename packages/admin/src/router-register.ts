import {
  BarChart3,
  Cpu,
  FileText,
  LayoutDashboard,
  type LucideIcon,
  MessageSquare,
  Settings as SettingsIcon,
  Shield,
  User,
  Users,
} from 'lucide-react'
import type { FileRoutesByFullPath } from './routeTree.gen'

type RoutePath = keyof FileRoutesByFullPath

export type RouteKey =
  | 'login'
  | 'dashboard'
  | 'users'
  | 'userDetail'
  | 'roles'
  | 'roleDetail'
  | 'rag'
  | 'sessions'
  | 'sessionDetail'
  | 'audit'
  | 'profile'
  | 'modelProviders'
  | 'moduleSettings'

export interface RouteMeta {
  key: RouteKey
  title: string
  path: RoutePath
  icon?: LucideIcon | null
  nav: boolean
}

export const ROUTES_REGISTER: Record<RouteKey, RouteMeta> = {
  login: {
    key: 'login',
    title: '登录',
    path: '/login' as RoutePath,
    icon: null,
    nav: false,
  },
  dashboard: {
    key: 'dashboard',
    title: '控制台',
    path: '/dashboard' as RoutePath,
    icon: LayoutDashboard,
    nav: true,
  },
  users: {
    key: 'users',
    title: '用户管理',
    path: '/users' as RoutePath,
    icon: Users,
    nav: true,
  },
  userDetail: {
    key: 'userDetail',
    title: '用户详情',
    path: '/users/$id' as RoutePath,
    icon: User,
    nav: false,
  },
  roles: {
    key: 'roles',
    title: '权限管理',
    path: '/roles' as RoutePath,
    icon: Shield,
    nav: true,
  },
  roleDetail: {
    key: 'roleDetail',
    title: '角色详情',
    path: '/roles/$id' as RoutePath,
    icon: Shield,
    nav: false,
  },
  rag: {
    key: 'rag',
    title: 'RAG 观测',
    path: '/rag-observability' as RoutePath,
    icon: BarChart3,
    nav: true,
  },
  sessions: {
    key: 'sessions',
    title: '会话观测',
    path: '/sessions' as RoutePath,
    icon: MessageSquare,
    nav: true,
  },
  sessionDetail: {
    key: 'sessionDetail',
    title: '会话详情',
    path: '/sessions/$id' as RoutePath,
    icon: MessageSquare,
    nav: false,
  },
  audit: {
    key: 'audit',
    title: '审计日志',
    path: '/audit' as RoutePath,
    icon: FileText,
    nav: true,
  },
  profile: {
    key: 'profile',
    title: '个人中心',
    path: '/profile' as RoutePath,
    icon: SettingsIcon,
    nav: false,
  },
  modelProviders: {
    key: 'modelProviders',
    title: '模型提供商',
    path: '/model-providers' as RoutePath,
    icon: Cpu,
    nav: true,
  },
  moduleSettings: {
    key: 'moduleSettings',
    title: '模块配置',
    path: '/module-settings' as RoutePath,
    icon: SettingsIcon,
    nav: true,
  },
}

export function getNavItems(): RouteMeta[] {
  return Object.values(ROUTES_REGISTER).filter((r) => r.nav)
}
