import { createFileRoute } from '@tanstack/react-router'
import { ChatPage } from '@/features/chat/components/ChatPage'
import { ROUTES_REGISTER } from '@/router-register'
import { resolveSessionForRoute } from '@/features/chat/services'

export const Route = createFileRoute('/_authenticated/chat/$sessionId')({
  component: ChatPageWrapper,
  staticData: {
    meta: ROUTES_REGISTER.chat,
  },
  loader: async ({ params }) => {
    return resolveSessionForRoute(params.sessionId)
  },
  errorComponent: ({ error }) => {
    return (
      <div className="flex h-full items-center justify-center text-red-500">
        加载失败: {error instanceof Error ? error.message : '未知错误'}
      </div>
    )
  },
})

function ChatPageWrapper() {
  const { sessionId, isTemp } = Route.useLoaderData()
  return <ChatPage sessionId={sessionId} isTemp={isTemp} />
}
