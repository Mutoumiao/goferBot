import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址').describe('用户邮箱地址'),
  encryptedPassword: z.string().min(1, '密码不能为空').max(4096, '密码数据异常').describe('RSA 加密后的密码'),
})

export class LoginDto extends createZodDto(loginSchema) {}
