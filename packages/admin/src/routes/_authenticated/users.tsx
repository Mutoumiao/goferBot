import { createFileRoute } from '@tanstack/react-router'
import { UserTable } from '@/features/users/components/UserTable'

export const Route = createFileRoute('/_authenticated/users')({
  component: UsersPage,
})

function UsersPage() {
  return <UserTable />
}
