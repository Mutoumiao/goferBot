import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const createFolderSchema = z.object({
  name: z.string().min(1, '文件夹名称不能为空').max(100, '名称过长'),
  parentId: z.string().uuid('parentId 格式非法').nullable().optional(),
})

export class CreateFolderDto extends createZodDto(createFolderSchema) {}
