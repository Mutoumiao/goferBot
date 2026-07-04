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

export const adminRoleCodeSchema = z.enum(['super_admin', 'admin', 'user'])

export const adminUserListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).describe('页码'),
  pageSize: z.coerce.number().int().min(1).max(50).default(10).describe('每页条数'),
  search: z.string().optional().describe('邮箱模糊搜索'),
  isActive: z
    .union([z.boolean(), z.string(), z.number()])
    .transform((v) => toBoolean(v))
    .optional()
    .describe('按状态过滤'),
  role: adminRoleCodeSchema.optional().describe('按角色过滤'),
})

export const updateUserStatusRequestSchema = z.object({
  isActive: z.boolean({ message: 'isActive 必须是布尔值' }).describe('用户状态'),
})

export const adminUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  avatar: z.string().nullable().optional(),
  roles: z.array(adminRoleCodeSchema),
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
  roles: z.array(adminRoleCodeSchema).default(['user']),
})

export const updateAdminUserRequestSchema = z.object({
  name: z.string().optional(),
  roles: z.array(adminRoleCodeSchema).optional(),
  isActive: z.boolean().optional(),
  updatedAt: z.string().optional(),
})

export const resetPasswordRequestSchema = z.object({
  newPassword: z.string(),
})

export const assignRoleRequestSchema = z.object({
  roles: z.array(adminRoleCodeSchema),
})

export const invitationCodeTypeSchema = z.enum(['standard', 'multi'])

export const createInvitationRequestSchema = z.object({
  type: invitationCodeTypeSchema.default('standard'),
  maxUses: z.coerce.number().int().min(1).max(1000).optional(),
  note: z.string().max(200).optional(),
  expiresAt: z.string().datetime().optional(),
})

export const invitationCodeSchema = z.object({
  id: z.string(),
  code: z.string(),
  type: z.string(),
  maxUses: z.number().nullable(),
  usedCount: z.number(),
  note: z.string().nullable(),
  expiresAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  creatorName: z.string().nullable(),
  usedByUserEmail: z.string().nullable(),
  isActive: z.boolean(),
})

export const invitationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  type: invitationCodeTypeSchema.optional(),
  active: z.coerce.boolean().optional(),
})

export const invitationListResponseSchema = z.object({
  items: z.array(invitationCodeSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
})
