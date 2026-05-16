import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const createSessionSchema = z.object({
  title: z.string().max(100, '标题过长').optional(),
  provider: z.string().max(50, '提供商名称过长').optional(),
  model: z.string().max(50, '模型名称过长').optional(),
})

export class CreateSessionDto extends createZodDto(createSessionSchema) {}
