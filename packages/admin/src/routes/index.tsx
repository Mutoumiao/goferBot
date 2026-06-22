import { createFileRoute, redirect } from '@tanstack/react-router'
import { ROUTES_REGISTER } from '@/router-register'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: ROUTES_REGISTER.dashboard.path })
  },
})
