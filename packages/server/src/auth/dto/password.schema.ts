import { BadRequestException } from '@nestjs/common'

// ponytail: bcrypt 在 72 字节处截断，超过部分不参与哈希；限制 72 避免用户误以为长密码更安全
const PASSWORD_MIN = 8
const PASSWORD_MAX = 72

export function validatePassword(password: string): void {
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: `密码长度需在 ${PASSWORD_MIN}-${PASSWORD_MAX} 个字符之间`,
    })
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: '密码必须同时包含大小写字母',
    })
  }
  if (!/\d/.test(password)) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: '密码必须包含数字',
    })
  }
}
