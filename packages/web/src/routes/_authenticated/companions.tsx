import { createFileRoute, Outlet } from '@tanstack/react-router'
import { ROUTES_REGISTER } from '@/router-register'

/**
 * /companions 布局路由。
 *
 * 作为列表 / 聊天 / 记忆库的公共父级，必须渲染 Outlet，
 * 否则子路由（$companionId/chat、memories）无法挂载。
 */
export const Route = createFileRoute('/_authenticated/companions')({
  component: CompanionsLayout,
  staticData: {
    meta: ROUTES_REGISTER.companion,
  },
})

function CompanionsLayout() {
  return <Outlet />
}
