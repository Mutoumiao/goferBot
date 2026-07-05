import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { ROUTES_REGISTER } from '@/router-register'
import { useAuthStore } from '@/stores/auth'
import {
  buildLoginRedirectSearch,
  getAuthSnapshot,
  hasAnyPermission,
  waitForAuthInit,
} from '@/utils/auth-guard'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    const authed = await waitForAuthInit()
    const snapshot = getAuthSnapshot()
    if (!authed || !snapshot.isAuthenticated) {
      throw redirect({
        to: ROUTES_REGISTER.login.path,
        search: buildLoginRedirectSearch(location),
      })
    }

    const routeMeta = Object.values(ROUTES_REGISTER).find((r) => r.path === location.pathname)
    if (
      routeMeta?.requiredPermission &&
      !hasAnyPermission(snapshot, [routeMeta.requiredPermission])
    ) {
      throw redirect({ to: '/forbidden' })
    }
  },
  component: AppLayout,
})

function AppLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) {
    return null
  }
  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  )
}
