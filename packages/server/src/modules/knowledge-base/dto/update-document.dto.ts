import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const updateDocumentSchema = z.object({
  name: z.string().min(1, '文件名不能为空').max(255, '文件名过长').optional(),
  folderId: z.string().uuid('folderId 格式非法').nullable().optional(),
})

export class UpdateDocumentDto extends createZodDto(updateDocumentSchema) {}
