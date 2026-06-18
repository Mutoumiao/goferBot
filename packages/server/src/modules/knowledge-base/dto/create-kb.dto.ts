import { createKbRequestSchema } from '@goferbot/data/schemas'
import { createZodDto } from 'nestjs-zod'

export class CreateKbDto extends createZodDto(createKbRequestSchema) {}
