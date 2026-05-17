import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码至少需要6个字符'),
})

export class LoginDto extends createZodDto(loginSchema) {}
