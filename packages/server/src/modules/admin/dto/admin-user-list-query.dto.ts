import { createZodDto } from 'nestjs-zod'
import { adminUserListQuerySchema } from '@goferbot/data/schemas'

export class AdminUserListQueryDto extends createZodDto(adminUserListQuerySchema) {
  declare page: number
  declare size: number
  declare search?: string
  declare isActive?: boolean
}