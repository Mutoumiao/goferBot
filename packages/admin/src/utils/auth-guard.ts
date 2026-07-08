import { useAuthStore } from '@/stores/auth'
import { fetchCurrentUser } from '@/features/auth/services'

export function waitForAuthInit(maxMs = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    const start = Date.now()
    const check = async () => {
      const state = useAuthStore.getState()

      if (state.isInitialized) {
        resolve(!!state.user)
        return
      }

      if (!state._hydrated) {
        if (Date.now() - start > maxMs) {
          useAuthStore.getState().setInitialized(true)
          resolve(!!state.user)
          return
        }
        setTimeout(check, 50)
        return
      }

      const ok = await fetchCurrentUser()
      resolve(ok)
    }
    check()
  })
}

export interface AuthStateSnapshot {
  isAuthenticated: boolean
  roles: string[]
  permissions: string[]
}

export function getAuthSnapshot(): AuthStateSnapshot {
  const s = useAuthStore.getState()
  return {
    isAuthenticated: s.isAuthenticated,
    roles: s.user?.roles ?? [],
    permissions: s.user?.permissions ?? [],
  }
}

export function isAdmin(snapshot: AuthStateSnapshot) {
  return (
    (snapshot.roles.includes('admin') || snapshot.roles.includes('super_admin')) &&
    snapshot.isAuthenticated
  )
}

export function isSuperAdmin(snapshot: AuthStateSnapshot) {
  return snapshot.roles.includes('super_admin') && snapshot.isAuthenticated
}

export function hasPermission(snapshot: AuthStateSnapshot, permission: string): boolean {
  if (!snapshot.isAuthenticated) return false
  if (snapshot.roles.includes('super_admin')) return true
  return snapshot.permissions.includes(permission)
}

export function hasAnyPermission(snapshot: AuthStateSnapshot, permissions: string[]): boolean {
  if (!snapshot.isAuthenticated) return false
  if (snapshot.roles.includes('super_admin')) return true
  return permissions.some((p) => snapshot.permissions.includes(p))
}

export function buildLoginRedirectSearch(location: {
  href: string
}): { redirect: string } | undefined {
  return location.href !== '/login' ? { redirect: location.href } : undefined
}
