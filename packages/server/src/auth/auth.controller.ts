import { Controller, Post, Get, Body, HttpCode, HttpStatus, UseGuards, BadRequestException } from '@nestjs/common'
import { Throttle, SkipThrottle } from '@nestjs/throttler'
import { AuthService } from './auth.service.js'
import { JwtAuthGuard } from './guards/jwt.guard.js'
import { CurrentUser } from './decorators/current-user.decorator.js'
import { PasswordEncryptionService } from './crypto/password-encryption.service.js'
import { LoginDto } from './dto/login.dto.js'
import { RegisterDto } from './dto/register.dto.js'

const PASSWORD_MIN = 6
const PASSWORD_MAX = 100
const PASSWORD_REGEX = /^(?=.*[a-zA-Z])(?=.*\d)/

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordEncryption: PasswordEncryptionService,
  ) {}

  @Get('public-key')
  @SkipThrottle({ default: true, auth: true })
  getPublicKey() {
    return {
      publicKey: this.passwordEncryption.getPublicKeyPem(),
      algorithm: 'RSA-OAEP',
      hash: 'SHA-256',
    }
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async register(@Body() dto: RegisterDto) {
    const password = this.decryptAndValidate(dto.encryptedPassword)
    return this.authService.register(dto.email, password, dto.name)
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async login(@Body() dto: LoginDto) {
    const password = this.decryptAndValidate(dto.encryptedPassword)
    return this.authService.login(dto.email, password)
  }

  private decryptAndValidate(encryptedPassword: string): string {
    let password: string
    try {
      password = this.passwordEncryption.decrypt(encryptedPassword)
    } catch {
      throw new BadRequestException({
        code: 'DECRYPT_FAILED',
        message: '密码解密失败，请刷新页面后重试',
      })
    }
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
    return password
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async refresh(@Body() dto: { refreshToken: string }) {
    return this.authService.refresh(dto.refreshToken)
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout() {
    // 当前为无状态 JWT，登出由客户端丢弃令牌实现
    // 后续可扩展为令牌黑名单机制
    return { success: true }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser('id') userId: string) {
    return this.authService.me(userId)
  }
}
