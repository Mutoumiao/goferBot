import { useMemo } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ROUTES_REGISTER, type RouteKey, type RouteMeta } from '@/router-register'
import { useAuthStore } from '@/stores/auth'

const EMPTY_PERMISSIONS: string[] = []

export interface MenuItem {
  key: RouteKey
  path: string
  title: string
  icon?: LucideIcon | null
  nav: boolean
}

export function useMenuConfig(): MenuItem[] {
  const user = useAuthStore((s) => s.user)

  return useMemo(() => {
    if (!user) return []

    if (user.mustChangePassword) {
      return Object.values(ROUTES_REGISTER)
        .filter((r: RouteMeta) => r.key === 'profile' && r.nav)
        .map((r) => ({
          key: r.key,
          path: r.path as string,
          title: r.title,
          icon: r.icon ?? null,
          nav: r.nav,
        }))
    }

    const permissions = user.permissions ?? EMPTY_PERMISSIONS

    return Object.values(ROUTES_REGISTER)
      .filter((r: RouteMeta) => {
        if (!r.nav) return false
        if (!r.requiredPermission) return true
        return permissions.includes(r.requiredPermission)
      })
      .map((r) => ({
        key: r.key,
        path: r.path as string,
        title: r.title,
        icon: r.icon ?? null,
        nav: r.nav,
      }))
  }, [user])
}
