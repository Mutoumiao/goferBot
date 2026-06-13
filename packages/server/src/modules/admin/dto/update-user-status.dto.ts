import { createZodDto } from 'nestjs-zod'
import { updateUserStatusRequestSchema } from '@goferbot/data/schemas'

export class UpdateUserStatusDto extends createZodDto(updateUserStatusRequestSchema) {
  declare isActive: boolean
}