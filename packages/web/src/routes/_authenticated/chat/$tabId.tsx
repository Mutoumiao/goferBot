import { createFileRoute } from '@tanstack/react-router'
import { ChatPageByTab } from '@/features/chat/components/ChatPageByTab'
import { ROUTES_REGISTER } from '@/router-register'
import { tabManager } from '@/stores/tabManager'
import { useWorkspaceStore } from '@/stores/workspace.store'

export const Route = createFileRoute('/_authenticated/chat/$tabId')({
  beforeLoad: ({ params }) => {
    const tab = useWorkspaceStore.getState().tabs.find((t) => t.id === params.tabId)
    if (!tab) {
      tabManager.ensureChatTab(params.tabId)
    }
  },
  component: ChatPageByTabWrapper,
  staticData: {
    meta: ROUTES_REGISTER.chat,
  },
  errorComponent: ({ error }) => {
    return (
      <div className="flex h-full items-center justify-center text-red-500">
        加载失败: {error instanceof Error ? error.message : '未知错误'}
      </div>
    )
  },
})

function ChatPageByTabWrapper() {
  const { tabId } = Route.useParams()
  return <ChatPageByTab tabId={tabId} />
}
