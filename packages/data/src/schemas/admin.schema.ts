import { z } from 'zod'
import { pagerRequestSchema } from './common.schema.js'

function toBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    return value === 'true' || value === '1'
  }
  if (typeof value === 'number') {
    return value === 1
  }
  return undefined
}

export const adminUserListQuerySchema = pagerRequestSchema.extend({
  search: z.string().optional().describe('邮箱模糊搜索'),
  isActive: z
    .union([z.boolean(), z.string(), z.number()])
    .transform((v) => toBoolean(v))
    .optional()
    .describe('按状态过滤'),
})

export const updateUserStatusRequestSchema = z.object({
  isActive: z.boolean({ message: 'isActive 必须是布尔值' }).describe('用户状态'),
})

export const adminUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  role: z.enum(['admin', 'user']),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const adminUserListResponseSchema = z.object({
  items: z.array(adminUserSchema),
  total: z.number(),
})