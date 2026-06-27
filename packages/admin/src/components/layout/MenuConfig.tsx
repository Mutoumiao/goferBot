import type { LucideIcon } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { ROUTES_REGISTER, type RouteKey, type RouteMeta } from '@/router-register'

export interface MenuItem {
  key: RouteKey
  path: string
  title: string
  icon?: LucideIcon | null
  nav: boolean
}

type PermissionKey =
  | 'dashboard'
  | 'users'
  | 'roles'
  | 'rag'
  | 'sessions'
  | 'models'
  | 'audit'
  | 'profile'
  | 'modelProviders'
  | 'moduleSettings'

const ALLOWED_MENU_BY_ROLE: Record<'ADMIN' | 'USER', PermissionKey[]> = {
  ADMIN: [
    'dashboard',
    'users',
    'roles',
    'rag',
    'sessions',
    'models',
    'audit',
    'profile',
    'modelProviders',
    'moduleSettings',
  ],
  USER: ['dashboard', 'profile'],
}

/**
 * 根据当前登录用户角色裁剪后台菜单。
 * 仅返回允许当前角色访问且 nav=true 的菜单项。
 */
export function useMenuConfig(): MenuItem[] {
  const user = useAuthStore((s) => s.user)
  const role = user?.role ?? 'USER'
  const allowed = ALLOWED_MENU_BY_ROLE[role] as string[]

  return Object.values(ROUTES_REGISTER)
    .filter((r: RouteMeta) => r.nav && allowed.includes(r.key))
    .map((r) => ({
      key: r.key,
      path: r.path as string,
      title: r.title,
      icon: r.icon ?? null,
      nav: r.nav,
    }))
}
