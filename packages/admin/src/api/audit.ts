import { alovaInstance } from '@/utils/server'

export interface AuditLog {
  id: string
  actorId: string
  actorName: string
  action: string
  resource: string
  resourceId?: string
  ip?: string
  createdAt: string
  sensitive?: boolean
}

export interface AuditQuery {
  page?: number
  pageSize?: number
  action?: string
  startDate?: string
  endDate?: string
  actorId?: string
  sensitiveOnly?: boolean
}

export const fetchAuditLogs = (query: AuditQuery = {}) =>
  alovaInstance.Get<{ items: AuditLog[]; total: number }>('/admin/audit', { params: query })

export const exportAuditLogs = (query: AuditQuery = {}) =>
  alovaInstance.Get<Blob>('/admin/audit/export', { params: query })
