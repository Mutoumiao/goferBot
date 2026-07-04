import { updateAdminUserRequestSchema } from '@goferbot/data/schemas'
import { createZodDto } from 'nestjs-zod'

export class UpdateAdminUserDto extends createZodDto(updateAdminUserRequestSchema) {}
