import { createFileRoute } from '@tanstack/react-router'
import { ChatPage } from '@/features/chat/components/ChatPage'
import { ROUTES_REGISTER } from '@/router-register'
import { resolveSessionById } from '@/features/chat/services'
import { useTabsStore } from '@/stores/tabs'

export const Route = createFileRoute('/_authenticated/chat/$sessionId')({
  component: ChatPageWrapper,
  staticData: {
    meta: ROUTES_REGISTER.chat,
  },
  loader: async ({ params }) => {
    const { sessionId } = params
    const isTemp = sessionId.startsWith('temp_')

    if (!isTemp) {
      // 真实会话：加载会话详情并同步标签标题
      const session = await resolveSessionById(sessionId)
      if (session) {
        // 在 loader 中同步更新标签标题
        const tabsStore = useTabsStore.getState()
        const existingTab = tabsStore.tabs.find(t => t.sessionId === sessionId)
        if (existingTab && existingTab.title !== session.title) {
          tabsStore.renameTab(existingTab.id, session.title)
        }
      }
    }

    return { sessionId }
  },
})

function ChatPageWrapper() {
  const { sessionId } = Route.useLoaderData()
  return <ChatPage sessionId={sessionId} />
}
