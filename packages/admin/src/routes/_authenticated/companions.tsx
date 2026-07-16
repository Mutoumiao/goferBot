import { createFileRoute } from '@tanstack/react-router'
import { CompanionAdminPage } from '@/features/companions/components/CompanionAdminPage'

export const Route = createFileRoute('/_authenticated/companions')({
  component: CompanionsPage,
})

function CompanionsPage() {
  return <CompanionAdminPage />
}
