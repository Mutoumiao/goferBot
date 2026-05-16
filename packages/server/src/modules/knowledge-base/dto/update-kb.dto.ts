import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const updateKbSchema = z.object({
  name: z.string().min(1, '知识库名称不能为空').max(100, '名称过长').optional(),
  description: z.string().max(500, '描述过长').nullable().optional(),
  isPinned: z.boolean().optional(),
  sortOrder: z.number().int().min(0, '排序值不能为负数').optional(),
  icon: z.string().max(10, '图标过长').nullable().optional(),
})

export class UpdateKbDto extends createZodDto(updateKbSchema) {}
