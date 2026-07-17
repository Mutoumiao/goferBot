import { createFileRoute } from '@tanstack/react-router'
import { CompanionsWorkspace } from '@/features/companion/components/CompanionsWorkspace'
import { ROUTES_REGISTER } from '@/router-register'

/**
 * /companions — 一级工作台（左联系人 + 右内嵌聊天）。
 * 二级（新建/编辑/关怀/记忆）走命令式弹层，不挂子 path。
 * 实际渲染由 KeepAliveOutlet 缓存；route component 作匹配占位。
 */
export const Route = createFileRoute('/_authenticated/companions')({
  component: CompanionsWorkspace,
  staticData: {
    meta: ROUTES_REGISTER.companion,
    keepAlive: true,
  },
})
