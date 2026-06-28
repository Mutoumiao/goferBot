import { toast } from 'sonner'
import type { AuditLog, AuditQuery } from '@/api/audit'
import {
  exportAuditLogs as exportAuditLogsApi,
  fetchAuditLogs as fetchAuditLogsApi,
} from '@/api/audit'
import { mapErrorMessage } from '@/utils/error-mapper'

export type { AuditLog, AuditQuery }

export async function fetchAuditLogs(
  query: AuditQuery = {},
): Promise<{ items: AuditLog[]; total: number }> {
  try {
    return await fetchAuditLogsApi(query).send()
  } catch (err) {
    const msg = mapErrorMessage(err)
    toast.error(msg)
    return { items: [], total: 0 }
  }
}

export async function exportAuditLogs(query: AuditQuery = {}): Promise<Blob> {
  try {
    return await exportAuditLogsApi(query).send()
  } catch (err) {
    const msg = mapErrorMessage(err)
    toast.error(msg)
    throw err
  }
}
