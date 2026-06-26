import { createFileRoute } from '@tanstack/react-router'
import { CompanionChatPage } from '@/features/companion/components/CompanionChatPage'

export const Route = createFileRoute('/_authenticated/companions/$companionId/chat')({
  component: CompanionChatPageWrapper,
})

function CompanionChatPageWrapper() {
  const { companionId } = Route.useParams()
  return <CompanionChatPage companionId={companionId} />
}
