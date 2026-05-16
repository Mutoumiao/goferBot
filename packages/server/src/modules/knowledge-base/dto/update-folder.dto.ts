import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const updateFolderSchema = z.object({
  name: z.string().min(1, '文件夹名称不能为空').max(100, '名称过长'),
})

export class UpdateFolderDto extends createZodDto(updateFolderSchema) {}
