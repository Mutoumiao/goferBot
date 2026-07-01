import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

const PASSWORD_MIN = 8
const PASSWORD_MAX = 72

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, '当前密码不能为空').max(PASSWORD_MAX),
  newPassword: z
    .string()
    .min(PASSWORD_MIN, `新密码至少 ${PASSWORD_MIN} 个字符`)
    .max(PASSWORD_MAX)
    .regex(/[a-z]/, '新密码必须包含小写字母')
    .regex(/[A-Z]/, '新密码必须包含大写字母')
    .regex(/\d/, '新密码必须包含数字'),
})

export class ChangePasswordDto extends createZodDto(ChangePasswordSchema) {}
