import { createFileRoute } from '@tanstack/react-router'
import { SessionDetail } from '@/features/sessions/components/SessionDetail'

export const Route = createFileRoute('/_authenticated/sessions/$id')({
  component: SessionDetail,
})
