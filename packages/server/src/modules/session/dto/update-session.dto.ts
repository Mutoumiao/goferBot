import { createZodDto } from 'nestjs-zod'
import { updateSessionRequestSchema } from '@goferbot/data/schemas'

export class UpdateSessionDto extends createZodDto(updateSessionRequestSchema) {}
