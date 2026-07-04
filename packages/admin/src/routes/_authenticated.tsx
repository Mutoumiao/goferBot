import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { ForbiddenPage } from '@/components/ForbiddenPage'
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
    await waitForAuthInit()
    const snapshot = getAuthSnapshot()
    if (!snapshot.isAuthenticated) {
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
    return <ForbiddenPage />
  }
  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  )
}
