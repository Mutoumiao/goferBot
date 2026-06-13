import { createZodDto } from 'nestjs-zod'
import { loginRequestSchema } from '@goferbot/data/schemas'

export class LoginDto extends createZodDto(loginRequestSchema) {
  declare email: string
  declare encryptedPassword: string
}