import { updateUserStatusRequestSchema } from '@goferbot/data/schemas'
import { createZodDto } from 'nestjs-zod'

export class UpdateUserStatusDto extends createZodDto(updateUserStatusRequestSchema) {}
