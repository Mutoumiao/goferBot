import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const registerSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  encryptedPassword: z.string().min(1, '密码不能为空').max(4096, '密码数据异常'),
  name: z.string().min(1, '请输入昵称').max(50, '昵称过长').optional(),
})

export class RegisterDto extends createZodDto(registerSchema) {}
