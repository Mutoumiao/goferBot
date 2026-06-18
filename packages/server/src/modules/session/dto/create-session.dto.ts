import { createSessionRequestSchema } from '@goferbot/data/schemas'
import { createZodDto } from 'nestjs-zod'

export class CreateSessionDto extends createZodDto(createSessionRequestSchema) {}
