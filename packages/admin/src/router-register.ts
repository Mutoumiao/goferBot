import {
  BarChart3,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Shield,
  User,
  Users,
  Settings as SettingsIcon,
  Cpu,
  type LucideIcon,
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
  | 'models'
  | 'audit'
  | 'profile'

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
  models: {
    key: 'models',
    title: '模型设置',
    path: '/models' as RoutePath,
    icon: Cpu,
    nav: true,
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
}

export function getNavItems(): RouteMeta[] {
  return Object.values(ROUTES_REGISTER).filter((r) => r.nav)
}
