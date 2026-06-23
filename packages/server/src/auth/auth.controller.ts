import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { AuthService } from './auth.service.js'
import { PasswordEncryptionService } from './crypto/password-encryption.service.js'
import { CurrentUser } from './decorators/current-user.decorator.js'
import { LoginDto } from './dto/login.dto.js'
import { RegisterDto } from './dto/register.dto.js'
import { UpdateProfileDto } from './dto/update-profile.dto.js'
import { JwtAuthGuard } from './guards/jwt.guard.js'

const PASSWORD_MIN = 6
// ponytail: bcrypt 在 72 字节处截断，超过部分不参与哈希；限制 72 避免用户误以为长密码更安全
const PASSWORD_MAX = 72
const PASSWORD_REGEX = /^(?=.*[a-zA-Z])(?=.*\d)/

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordEncryption: PasswordEncryptionService,
  ) {}

  @Get('public-key')
  @Throttle({ default: { ttl: 60000, limit: 60 } })
  getPublicKey(@Res({ passthrough: true }) res: FastifyReply) {
    res.header('Cache-Control', 'public, max-age=3600')
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
  async logout(@CurrentUser('id') userId: string, @Req() req: FastifyRequest) {
    const authHeader = req.headers.authorization
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      // 将 token 加入黑名单，过期时间与 access token 一致（默认 2h）
      await this.authService.blacklistToken(token)
      // 清除用户缓存，确保登出后状态即时生效
      await this.authService.invalidateUserCache(userId)
    }
    return { success: true }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser('id') userId: string) {
    return this.authService.me(userId)
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(userId, dto)
  }

  @Post('avatar')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async uploadAvatar(@CurrentUser('id') userId: string, @Req() req: FastifyRequest) {
    const data = await req.file()
    if (!data) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '请上传头像文件',
      })
    }

    // 前置校验：文件类型与大小（在流读取前拦截）
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedMimeTypes.includes(data.mimetype)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '仅支持 JPEG、PNG、GIF、WebP 格式的图片',
      })
    }

    const chunks: Buffer[] = []
    for await (const chunk of data.file) {
      chunks.push(chunk as Buffer)
    }
    const buffer = Buffer.concat(chunks)

    // 校验是否因大小限制被截断
    if (data.file.truncated) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '头像文件大小不能超过 5MB',
      })
    }

    return this.authService.uploadAvatar(userId, {
      buffer,
      mimetype: data.mimetype,
      size: buffer.length,
    })
  }
}
