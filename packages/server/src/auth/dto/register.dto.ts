import { registerRequestSchema } from '@goferbot/data/schemas'
import { createZodDto } from 'nestjs-zod'

export class RegisterDto extends createZodDto(registerRequestSchema) {
  declare email: string
  declare encryptedPassword: string
  declare name?: string
}
