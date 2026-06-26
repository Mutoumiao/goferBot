import { createFileRoute } from '@tanstack/react-router'
import { ROUTES_REGISTER } from '@/router-register'
import { CompanionListPage } from '@/features/companion/components/CompanionListPage'

export const Route = createFileRoute('/_authenticated/companions')({
  component: CompanionListPage,
  staticData: {
    meta: ROUTES_REGISTER.companion,
  },
})
