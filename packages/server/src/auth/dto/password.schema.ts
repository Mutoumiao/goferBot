import { BadRequestException } from '@nestjs/common'

// ponytail: bcrypt 在 72 字节处截断，超过部分不参与哈希；限制 72 避免用户误以为长密码更安全
const PASSWORD_MIN = 6
const PASSWORD_MAX = 72
const PASSWORD_REGEX = /^(?=.*[a-zA-Z])(?=.*\d)/

export function validatePassword(password: string): void {
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: `密码长度需在 ${PASSWORD_MIN}-${PASSWORD_MAX} 个字符之间`,
    })
  }
  if (!PASSWORD_REGEX.test(password)) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: '密码需同时包含字母和数字',
    })
  }
}
