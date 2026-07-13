import { createFileRoute } from '@tanstack/react-router'
import { CompanionFormPage } from '@/features/companion/components/CompanionFormPage'

export const Route = createFileRoute('/_authenticated/companions/$companionId/edit')({
  component: CompanionEditPage,
})

function CompanionEditPage() {
  const { companionId } = Route.useParams()
  return <CompanionFormPage mode="edit" companionId={companionId} />
}
