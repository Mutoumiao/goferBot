import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const AdminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  captchaId: z.string().min(1).optional(),
  captchaCode: z.string().min(1).optional(),
})

export class AdminLoginDto extends createZodDto(AdminLoginSchema) {}
