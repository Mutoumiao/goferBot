import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { PermissionMatrix } from '@/features/roles/components/PermissionMatrix'

export const Route = createFileRoute('/_authenticated/roles/$id')({
  component: RoleDetailPage,
})

function RoleDetailPage() {
  const params = Route.useParams()
  const navigate = useNavigate()
  return <PermissionMatrix roleId={params.id} onBack={() => navigate({ to: '/roles' })} />
}
