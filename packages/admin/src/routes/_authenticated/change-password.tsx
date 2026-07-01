import { createFileRoute } from '@tanstack/react-router'
import { PasswordChangeForm } from '@/features/profile/components/PasswordChangeForm'

export const Route = createFileRoute('/_authenticated/change-password')({
  component: ChangePasswordPage,
})

function ChangePasswordPage() {
  return <PasswordChangeForm />
}