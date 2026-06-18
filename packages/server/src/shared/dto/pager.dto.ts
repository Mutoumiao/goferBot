import { pagerRequestSchema } from '@goferbot/data/schemas'
import { createZodDto } from 'nestjs-zod'

export class PagerDto extends createZodDto(pagerRequestSchema) {}
