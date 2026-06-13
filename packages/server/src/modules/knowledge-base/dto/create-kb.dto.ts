import { createZodDto } from 'nestjs-zod'
import { createKbRequestSchema } from '@goferbot/data/schemas'

export class CreateKbDto extends createZodDto(createKbRequestSchema) {
  declare name: string
  declare description?: string
  declare icon?: string
}