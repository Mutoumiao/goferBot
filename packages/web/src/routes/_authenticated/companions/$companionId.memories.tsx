import { createFileRoute } from '@tanstack/react-router'
import { CompanionMemoriesPage } from '@/features/companion/components/CompanionMemoriesPage'

export const Route = createFileRoute('/_authenticated/companions/$companionId/memories')({
  component: CompanionMemoriesPageWrapper,
})

function CompanionMemoriesPageWrapper() {
  const { companionId } = Route.useParams()
  return <CompanionMemoriesPage companionId={companionId} />
}
