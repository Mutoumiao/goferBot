import { z } from 'zod'

export const auditLogSchema = z.object({
  id: z.string(),
  actorId: z.string(),
  actorName: z.string(),
  action: z.string(),
  resource: z.string(),
  resourceId: z.string().optional(),
  ip: z.string().optional(),
  createdAt: z.string(),
  sensitive: z.boolean().optional(),
})

export const auditQuerySchema = z.object({
  page: z.number().optional(),
  pageSize: z.number().optional(),
  action: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  actorId: z.string().optional(),
  sensitiveOnly: z.boolean().optional(),
})

export const auditLogListResponseSchema = z.object({
  items: z.array(auditLogSchema),
  total: z.number(),
})
