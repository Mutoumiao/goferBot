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

export async function fetchAuditLogs(query: AuditQuery = {}): Promise<{ items: AuditLog[]; total: number }> {
  try {
    const mod = await import('@/utils/server')
    return await mod.alovaInstance.Get<{ items: AuditLog[]; total: number }>('/admin/audit', { params: query }).send()
  } catch {
    const items = getMockData()
    return { items, total: items.length }
  }
}

export async function exportAuditLogs(query: AuditQuery = {}): Promise<Blob> {
  const mod = await import('@/utils/server')
  return await mod.alovaInstance.Get<Blob>('/admin/audit/export', { params: query }).send()
}

function getMockData(): AuditLog[] {
  const now = Date.now()
  return [
    { id: '1', actorId: 'u_admin', actorName: 'admin@example.com', action: 'LOGIN', resource: 'auth', ip: '192.168.1.100', createdAt: new Date(now - 60000).toISOString() },
    { id: '2', actorId: 'u_admin', actorName: 'admin@example.com', action: 'USER_CREATE', resource: 'user', resourceId: 'u_new1', ip: '192.168.1.100', createdAt: new Date(now - 120000).toISOString() },
    { id: '3', actorId: 'u_admin', actorName: 'admin@example.com', action: 'USER_DELETE', resource: 'user', resourceId: 'u_del1', ip: '192.168.1.100', createdAt: new Date(now - 240000).toISOString(), sensitive: true },
    { id: '4', actorId: 'u_admin', actorName: 'admin@example.com', action: 'ROLE_UPDATE', resource: 'role', resourceId: 'r_1', ip: '192.168.1.100', createdAt: new Date(now - 360000).toISOString(), sensitive: true },
    { id: '5', actorId: 'u_admin', actorName: 'admin@example.com', action: 'API_KEY_REVEAL', resource: 'model', resourceId: 'm_1', ip: '192.168.1.100', createdAt: new Date(now - 480000).toISOString(), sensitive: true },
  ]
}
