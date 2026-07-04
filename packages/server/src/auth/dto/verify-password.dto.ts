import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const VerifyPasswordSchema = z.object({
  password: z.string().min(1, '密码不能为空'),
})

export class VerifyPasswordDto extends createZodDto(VerifyPasswordSchema) {}
