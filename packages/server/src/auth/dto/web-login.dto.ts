import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const WebLoginSchema = z.object({
  email: z.string().email(),
  encryptedPassword: z.string().min(1),
  captchaId: z.string().min(1).optional(),
  captchaCode: z.string().min(1).optional(),
})

export class WebLoginDto extends createZodDto(WebLoginSchema) {}
