import { createZodDto } from 'nestjs-zod'
import { updateKbRequestSchema } from '@goferbot/data/schemas'

export class UpdateKbDto extends createZodDto(updateKbRequestSchema) {}
