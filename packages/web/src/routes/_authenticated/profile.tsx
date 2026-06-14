import { createFileRoute } from '@tanstack/react-router'
import { ProfilePage } from '@/features/auth/components/ProfilePage'
import { ROUTES_REGISTER } from '@/router-register'

export const Route = createFileRoute('/_authenticated/profile')({
  component: ProfilePage,
  staticData: {
    meta: ROUTES_REGISTER.profile,
  },
})
