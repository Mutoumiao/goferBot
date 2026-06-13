import { createZodDto } from 'nestjs-zod'
import { createSessionRequestSchema } from '@goferbot/data/schemas'

export class CreateSessionDto extends createZodDto(createSessionRequestSchema) {
  declare title?: string
  declare provider?: string
  declare model?: string
}