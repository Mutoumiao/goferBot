import { updateKbRequestSchema } from '@goferbot/data/schemas'
import { createZodDto } from 'nestjs-zod'

export class UpdateKbDto extends createZodDto(updateKbRequestSchema) {}
