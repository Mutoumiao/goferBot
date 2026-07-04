import { useAuthStore } from '@/stores/auth'

export function waitForAuthInit(maxMs = 3000): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now()
    const check = () => {
      const state = useAuthStore.getState()
      if (state._hydrated && state.isInitialized) {
        resolve()
        return
      }
      if (Date.now() - start > maxMs) {
        useAuthStore.getState().setInitialized(true)
        resolve()
        return
      }
      setTimeout(check, 50)
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
