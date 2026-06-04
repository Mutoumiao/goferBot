import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { pagerSchema } from '../../../shared/dto/pager.dto.js'

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

export const adminUserListQuerySchema = pagerSchema.extend({
  search: z.string().optional().describe('邮箱模糊搜索'),
  isActive: z
    .union([z.boolean(), z.string(), z.number()])
    .transform((v) => toBoolean(v))
    .optional()
    .describe('按状态过滤'),
})

export class AdminUserListQueryDto extends createZodDto(adminUserListQuerySchema) {}
