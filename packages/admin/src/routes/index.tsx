import { createFileRoute, redirect } from '@tanstack/react-router'
import { ROUTES_REGISTER } from '@/router-register'
import { getAuthSnapshot, waitForAuthInit } from '@/utils/auth-guard'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    await waitForAuthInit()
    const snapshot = getAuthSnapshot()
    // 根入口按登录态分流：未登录直接进登录页，不进入受保护的 dashboard 链路
    throw redirect({
      to: snapshot.isAuthenticated ? ROUTES_REGISTER.dashboard.path : ROUTES_REGISTER.login.path,
    })
  },
})
