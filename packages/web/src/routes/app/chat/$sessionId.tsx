import { createFileRoute } from '@tanstack/react-router'
import { ChatSessionPage } from '@/features/chat/components/ChatSessionPage'

export const Route = createFileRoute('/app/chat/$sessionId')({
  component: ChatSessionPageWrapper,
  staticData: {
    tabMeta: {
      title: '新对话',
      singleton: false,
      closable: true,
    },
  },
})

function ChatSessionPageWrapper() {
  const { sessionId } = Route.useParams()
  return <ChatSessionPage sessionId={sessionId} />
}
