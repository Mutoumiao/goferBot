import { adminUserListQuerySchema } from '@goferbot/data/schemas'
import { createZodDto } from 'nestjs-zod'

export class AdminUserListQueryDto extends createZodDto(adminUserListQuerySchema) {}
