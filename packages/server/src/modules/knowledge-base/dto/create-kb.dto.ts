import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const createKbSchema = z.object({
  name: z.string().min(1, '知识库名称不能为空').max(100, '名称过长'),
  description: z.string().max(500, '描述过长').optional(),
  icon: z.string().max(10, '图标过长').optional(),
})

export class CreateKbDto extends createZodDto(createKbSchema) {}
