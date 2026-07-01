import { createFileRoute } from '@tanstack/react-router'
import { ForbiddenPage } from '@/components/ForbiddenPage'

export const Route = createFileRoute('/forbidden')({
  component: ForbiddenPage,
})
