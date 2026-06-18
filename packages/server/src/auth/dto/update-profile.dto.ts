import { updateProfileRequestSchema } from '@goferbot/data/schemas'
import { createZodDto } from 'nestjs-zod'

export class UpdateProfileDto extends createZodDto(updateProfileRequestSchema) {
  declare name: string
}
