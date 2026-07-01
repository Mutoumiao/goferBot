import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const AdminLoginSchema = z.object({
  email: z.string().email(),
  encryptedPassword: z
    .string()
    .min(1, 'Password cannot be empty')
    .max(4096, 'Password data anomaly'),
  captchaId: z.string().min(1).optional(),
  captchaCode: z.string().min(1).optional(),
})

export class AdminLoginDto extends createZodDto(AdminLoginSchema) {}
