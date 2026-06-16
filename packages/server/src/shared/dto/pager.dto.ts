import { createZodDto } from 'nestjs-zod'
import { pagerRequestSchema } from '@goferbot/data/schemas'

export class PagerDto extends createZodDto(pagerRequestSchema) {}
