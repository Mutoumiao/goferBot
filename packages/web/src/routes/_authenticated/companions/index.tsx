import { createFileRoute } from '@tanstack/react-router'
import { CompanionListPage } from '@/features/companion/components/CompanionListPage'
import { ROUTES_REGISTER } from '@/router-register'

export const Route = createFileRoute('/_authenticated/companions/')({
  component: CompanionListPage,
  staticData: {
    meta: ROUTES_REGISTER.companion,
  },
})
