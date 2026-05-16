import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const registerSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码至少需要6个字符').max(100, '密码过长'),
  name: z.string().min(1, '请输入昵称').max(50, '昵称过长').optional(),
})

export class RegisterDto extends createZodDto(registerSchema) {}
