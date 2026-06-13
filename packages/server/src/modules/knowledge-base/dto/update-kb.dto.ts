import { createZodDto } from 'nestjs-zod'
import { updateKbRequestSchema } from '@goferbot/data/schemas'

export class UpdateKbDto extends createZodDto(updateKbRequestSchema) {
  declare name?: string
  declare description?: string | null | undefined
  declare isPinned?: boolean
  declare sortOrder?: number
  declare icon?: string | null | undefined
}