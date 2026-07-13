import { createFileRoute } from '@tanstack/react-router'
import { CompanionCarePage } from '@/features/companion/components/CompanionCarePage'

export const Route = createFileRoute('/_authenticated/companions/$companionId/care')({
  component: CompanionCarePageWrapper,
})

function CompanionCarePageWrapper() {
  const { companionId } = Route.useParams()
  return <CompanionCarePage companionId={companionId} />
}
