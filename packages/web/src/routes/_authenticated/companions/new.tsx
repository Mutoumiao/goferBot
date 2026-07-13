import { createFileRoute } from '@tanstack/react-router'
import { CompanionFormPage } from '@/features/companion/components/CompanionFormPage'

export const Route = createFileRoute('/_authenticated/companions/new')({
  component: CompanionCreatePage,
})

function CompanionCreatePage() {
  return <CompanionFormPage mode="create" />
}
