import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const WebLoginSchema = z.object({
  email: z.string().email(),
  encryptedPassword: z.string().min(1),
})

export class WebLoginDto extends createZodDto(WebLoginSchema) {}
