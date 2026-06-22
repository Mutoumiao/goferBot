import { toast } from 'sonner'
import { fetchAuditLogs as fetchAuditLogsApi, exportAuditLogs as exportAuditLogsApi, type AuditLog, type AuditQuery } from '@/api/audit'
import { mapErrorMessage } from '@/utils/error-mapper'

export async function fetchAuditLogs(query: AuditQuery = {}): Promise<{ items: AuditLog[]; total: number }> {
  try {
    return await fetchAuditLogsApi(query)
  } catch (err) {
    const msg = mapErrorMessage(err)
    toast.error(msg)
    return { items: [], total: 0 }
  }
}

export async function exportAuditLogs(query: AuditQuery = {}): Promise<Blob> {
  try {
    return await exportAuditLogsApi(query)
  } catch (err) {
    const msg = mapErrorMessage(err)
    toast.error(msg)
    throw err
  }
}
