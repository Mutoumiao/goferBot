import { createFileRoute } from '@tanstack/react-router'
import { ChatSession } from './ChatSession'

export const Route = createFileRoute('/app/chat/$sessionId')({
  component: ChatSessionPage,
})

function ChatSessionPage() {
  const { sessionId } = Route.useParams()
  return <ChatSession sessionId={sessionId} />
}
