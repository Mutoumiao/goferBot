import { createZodDto } from 'nestjs-zod'
import { registerRequestSchema } from '@goferbot/data/schemas'

export class RegisterDto extends createZodDto(registerRequestSchema) {
  declare email: string
  declare encryptedPassword: string
  declare name?: string
}