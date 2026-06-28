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
import { AdminLoginDto } from './dto/admin-login.dto.js'
import { LoginDto } from './dto/login.dto.js'
import { LogoutDto } from './dto/logout.dto.js'
import { RegisterDto } from './dto/register.dto.js'
import { UpdateProfileDto } from './dto/update-profile.dto.js'
import { WebLoginDto } from './dto/web-login.dto.js'
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

  @Post('web/login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async webLogin(@Body() dto: WebLoginDto, @Req() req: FastifyRequest) {
    const password = this.decryptAndValidate(dto.encryptedPassword)
    return this.authService.login(dto.email, password, 'web', {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    })
  }

  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async adminLogin(@Body() dto: AdminLoginDto, @Req() req: FastifyRequest) {
    this.validatePassword(dto.password)
    return this.authService.login(dto.email, dto.password, 'admin', {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    })
  }

  /** @deprecated 旧登录入口，前端切走后移除 */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async legacyLogin(@Body() dto: LoginDto, @Req() req: FastifyRequest) {
    const password = this.decryptAndValidate(dto.encryptedPassword)
    return this.authService.login(dto.email, password, 'web', {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    })
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
    this.validatePassword(password)
    return password
  }

  private validatePassword(password: string): void {
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

  @Post('web/refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async webRefresh(@Body() dto: { refreshToken: string }) {
    return this.authService.refresh(dto.refreshToken)
  }

  @Post('admin/refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async adminRefresh(@Body() dto: { refreshToken: string }) {
    return this.authService.refresh(dto.refreshToken)
  }

  /** @deprecated 旧刷新入口，前端切走后移除 */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async legacyRefresh(@Body() dto: { refreshToken: string }) {
    return this.authService.refresh(dto.refreshToken)
  }

  @Post('web/logout')
  @HttpCode(HttpStatus.OK)
  async webLogout(@Body() dto: LogoutDto) {
    await this.authService.logoutByRefreshToken(dto.refreshToken)
    return { success: true }
  }

  @Post('admin/logout')
  @HttpCode(HttpStatus.OK)
  async adminLogout(@Body() dto: LogoutDto) {
    await this.authService.logoutByRefreshToken(dto.refreshToken)
    return { success: true }
  }

  /** @deprecated 旧登出入口，使用 access token 黑名单，前端切走后移除 */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async legacyLogout(@CurrentUser('id') userId: string, @Req() req: FastifyRequest) {
    const authHeader = req.headers.authorization
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      await this.authService.blacklistToken(token)
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
