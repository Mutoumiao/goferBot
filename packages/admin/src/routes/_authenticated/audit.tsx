import { createFileRoute } from '@tanstack/react-router'
import { AuditLogTable } from '@/features/audit/components/AuditLogTable'

export const Route = createFileRoute('/_authenticated/audit')({
  component: AuditLogTable,
})
