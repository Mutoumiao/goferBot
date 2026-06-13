import { createZodDto } from 'nestjs-zod'
import { updateProfileRequestSchema } from '@goferbot/data/schemas'

export class UpdateProfileDto extends createZodDto(updateProfileRequestSchema) {
  declare name: string
}