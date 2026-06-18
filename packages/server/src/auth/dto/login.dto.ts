import { loginRequestSchema } from '@goferbot/data/schemas'
import { createZodDto } from 'nestjs-zod'

export class LoginDto extends createZodDto(loginRequestSchema) {
  declare email: string
  declare encryptedPassword: string
}
