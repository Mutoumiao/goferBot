import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { RoleList } from '@/features/roles/components/RoleList'

export const Route = createFileRoute('/_authenticated/roles')({
  component: RolesPage,
})

function RolesPage() {
  return <RoleList />
}

// Keep navigate import referenced
void useNavigate
