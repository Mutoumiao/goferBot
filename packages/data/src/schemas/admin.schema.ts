import { z } from 'zod'

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

export const adminUserListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).describe('页码'),
  pageSize: z.coerce.number().int().min(1).max(50).default(10).describe('每页条数'),
  search: z.string().optional().describe('邮箱模糊搜索'),
  isActive: z
    .union([z.boolean(), z.string(), z.number()])
    .transform((v) => toBoolean(v))
    .optional()
    .describe('按状态过滤'),
  role: z.enum(['ADMIN', 'USER']).optional().describe('按角色过滤'),
})

export const updateUserStatusRequestSchema = z.object({
  isActive: z.boolean({ message: 'isActive 必须是布尔值' }).describe('用户状态'),
})

export const adminUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  role: z.enum(['ADMIN', 'USER']),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const adminUserListResponseSchema = z.object({
  items: z.array(adminUserSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
})

export const createAdminUserRequestSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  password: z.string(),
  role: z.enum(['ADMIN', 'USER']),
})

export const updateAdminUserRequestSchema = z.object({
  name: z.string().optional(),
  role: z.enum(['ADMIN', 'USER']).optional(),
  isActive: z.boolean().optional(),
  updatedAt: z.string().optional(),
})

export const resetPasswordRequestSchema = z.object({
  newPassword: z.string(),
})

export const assignRoleRequestSchema = z.object({
  role: z.enum(['ADMIN', 'USER']),
})
