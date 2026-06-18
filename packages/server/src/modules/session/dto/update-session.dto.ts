import { updateSessionRequestSchema } from '@goferbot/data/schemas'
import { createZodDto } from 'nestjs-zod'

export class UpdateSessionDto extends createZodDto(updateSessionRequestSchema) {}
