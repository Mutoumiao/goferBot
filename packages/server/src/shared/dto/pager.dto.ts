import { createZodDto } from 'nestjs-zod'
import { pagerRequestSchema } from '@goferbot/data/schemas'

export class PagerDto extends createZodDto(pagerRequestSchema) {
  declare page: number
  declare size: number
}