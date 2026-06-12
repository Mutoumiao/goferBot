import { createFileRoute } from '@tanstack/react-router'
import { AuthContainer } from '@/features/auth/components/AuthContainer'
import { ROUTES_REGISTER } from '@/router-register'

export const Route = createFileRoute('/login')({
  component: LoginPage,
  staticData: {
    meta: ROUTES_REGISTER.login,
  },
})

function LoginPage() {
  return <AuthContainer />
}
