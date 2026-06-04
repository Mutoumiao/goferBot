import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const pagerSchema = z.object({
  page: z.coerce.number().int().min(1).default(1).describe('页码，最小 1'),
  size: z.coerce.number().int().min(1).max(50).default(10).describe('每页条数，最小 1，最大 50'),
})

export class PagerDto extends createZodDto(pagerSchema) {}
