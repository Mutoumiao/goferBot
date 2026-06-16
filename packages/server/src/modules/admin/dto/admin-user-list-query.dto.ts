import { createZodDto } from 'nestjs-zod'
import { adminUserListQuerySchema } from '@goferbot/data/schemas'

export class AdminUserListQueryDto extends createZodDto(adminUserListQuerySchema) {}
