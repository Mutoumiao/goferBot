import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const updateSessionSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(100, '标题过长'),
})

export class UpdateSessionDto extends createZodDto(updateSessionSchema) {}
