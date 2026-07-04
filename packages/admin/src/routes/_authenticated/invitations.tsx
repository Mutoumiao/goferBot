import { createFileRoute } from '@tanstack/react-router'
import { InvitationCodeTable } from '@/features/invitations/components/InvitationCodeTable'

export const Route = createFileRoute('/_authenticated/invitations')({
  component: InvitationCodeTable,
})
