import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const updateUserStatusSchema = z.object({
  isActive: z.boolean({ message: 'isActive 必须是布尔值' }).describe('用户状态'),
})

export class UpdateUserStatusDto extends createZodDto(updateUserStatusSchema) {}
