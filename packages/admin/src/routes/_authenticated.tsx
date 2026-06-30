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
    // ponytail: 凭据由 HttpOnly Cookie 承担；持久化 user 作为会话存在性判定
    if (!snapshot.isAuthenticated) {
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
  const snapshot = useAuthStore((s) => ({
    isAuthenticated: s.isAuthenticated,
    role: s.user?.role ?? null,
  }))
  if (!isAdmin(snapshot)) {
    return <ForbiddenPage />
  }
  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  )
}
