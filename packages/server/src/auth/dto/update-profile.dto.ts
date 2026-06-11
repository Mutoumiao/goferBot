import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const updateProfileSchema = z.object({
  name: z.string().min(1, '昵称不能为空').max(50, '昵称过长').describe('用户昵称'),
})

export class UpdateProfileDto extends createZodDto(updateProfileSchema) {}
