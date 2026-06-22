import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { ROUTES_REGISTER } from '@/router-register'
import { useAuthStore } from '@/stores/auth'
import { ForbiddenPage } from '@/components/ForbiddenPage'

function waitForInit(maxMs = 3000): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now()
    const check = () => {
      if (useAuthStore.getState().isInitialized) {
        resolve()
        return
      }
      if (Date.now() - start > maxMs) {
        resolve()
        return
      }
      setTimeout(check, 50)
    }
    check()
  })
}

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    await waitForInit()
    const state = useAuthStore.getState()
    const token = state.token
    if (!token) {
      const redirectTo = location.pathname + location.search
      throw redirect({
        to: ROUTES_REGISTER.login.path,
        search: redirectTo !== '/login' ? { redirect: redirectTo } : undefined,
      })
    }
    if (state.user?.role !== 'ADMIN') {
      throw new Error('FORBIDDEN')
    }
  },
  component: AppLayout,
})

function AppLayout() {
  const state = useAuthStore()
  if (state.user?.role !== 'ADMIN') {
    return <ForbiddenPage />
  }
  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  )
}
