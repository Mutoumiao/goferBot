import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { ForbiddenPage } from '@/components/ForbiddenPage'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { ROUTES_REGISTER } from '@/router-register'
import { useAuthStore } from '@/stores/auth'
import {
  buildLoginRedirectSearch,
  getAuthSnapshot,
  isAdmin,
  waitForAuthInit,
} from '@/utils/auth-guard'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    await waitForAuthInit()
    const snapshot = getAuthSnapshot()
    if (!snapshot.token) {
      throw redirect({
        to: ROUTES_REGISTER.login.path,
        search: buildLoginRedirectSearch(location),
      })
    }
    if (snapshot.role !== 'ADMIN') {
      throw new Error('FORBIDDEN')
    }
  },
  component: AppLayout,
})

function AppLayout() {
  const snapshot = useAuthStore((s) => ({ token: s.token, role: s.user?.role ?? null }))
  if (!isAdmin(snapshot)) {
    return <ForbiddenPage />
  }
  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  )
}
