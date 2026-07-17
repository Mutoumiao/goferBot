import { createFileRoute } from '@tanstack/react-router'
import { ChatsPage } from '@/features/chat/components/ChatsPage'
import { ROUTES_REGISTER } from '@/router-register'

/**
 * /chats — 会话一级页。
 * 选中会话由 chatStore.selectedSessionId 管理，不再使用 ?c=。
 * 实际渲染由 KeepAliveOutlet 缓存实例负责；此 route component 作类型/匹配占位。
 */
export const Route = createFileRoute('/_authenticated/chats')({
  component: ChatsPage,
  staticData: {
    meta: ROUTES_REGISTER.chats,
    keepAlive: true,
  },
})
