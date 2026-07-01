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
import { AVATAR_ALLOWED_MIME_TYPES } from './constants.js'
import { CookieHelper } from './cookie.helper.js'
import { PasswordEncryptionService } from './crypto/password-encryption.service.js'
import { CurrentUser } from './decorators/current-user.decorator.js'
import { AdminLoginDto } from './dto/admin-login.dto.js'
import { ChangePasswordDto } from './dto/change-password.dto.js'
import { ChangePasswordForceDto } from './dto/change-password-force.dto.js'
import { LoginDto } from './dto/login.dto.js'
import { validatePassword } from './dto/password.schema.js'
import { RegisterDto } from './dto/register.dto.js'
import { UpdateProfileDto } from './dto/update-profile.dto.js'
import { WebLoginDto } from './dto/web-login.dto.js'
import { JwtAuthGuard } from './guards/jwt.guard.js'

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordEncryption: PasswordEncryptionService,
    private readonly cookieHelper: CookieHelper,
  ) {}

  @Get('public-key')
  @Throttle({ default: { ttl: 60000, limit: 60 } })
  getPublicKey(@Res({ passthrough: true }) res: FastifyReply) {
    res.header('Cache-Control', 'no-store')
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
  async webLogin(@Body() dto: WebLoginDto, @Res({ passthrough: true }) res: FastifyReply) {
    const password = this.decryptAndValidate(dto.encryptedPassword)
    const result = await this.authService.login(dto.email, password, 'web', {
      captchaId: dto.captchaId,
      captchaCode: dto.captchaCode,
    })
    this.cookieHelper.setAuthCookies(res, result.accessToken, result.refreshToken)
    return { user: result.user, mustChangePassword: result.mustChangePassword }
  }

  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  async adminLogin(@Body() dto: AdminLoginDto, @Res({ passthrough: true }) res: FastifyReply) {
    const password = this.decryptAndValidate(dto.encryptedPassword)
    const result = await this.authService.login(dto.email, password, 'admin', {
      captchaId: dto.captchaId,
      captchaCode: dto.captchaCode,
    })
    this.cookieHelper.setAuthCookies(res, result.accessToken, result.refreshToken)
    return { user: result.user, mustChangePassword: result.mustChangePassword }
  }

  /** @deprecated 旧登录入口，前端切走后移除 */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async legacyLogin(@Body() dto: LoginDto) {
    const password = this.decryptAndValidate(dto.encryptedPassword)
    return this.authService.login(dto.email, password, 'web')
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
    validatePassword(password)
    return password
  }

  @Post('web/refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async webRefresh(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const refreshToken = req.cookies?.goferbot_refreshToken
    if (!refreshToken) {
      throw new BadRequestException({ code: 'REFRESH_TOKEN_MISSING', message: '未找到刷新令牌' })
    }
    const result = await this.authService.refresh(refreshToken)
    this.cookieHelper.setAuthCookies(res, result.accessToken, result.refreshToken)
    return { success: true, mustChangePassword: result.mustChangePassword }
  }

  @Post('admin/refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async adminRefresh(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const refreshToken = req.cookies?.goferbot_refreshToken
    if (!refreshToken) {
      throw new BadRequestException({ code: 'REFRESH_TOKEN_MISSING', message: '未找到刷新令牌' })
    }
    const result = await this.authService.refresh(refreshToken)
    this.cookieHelper.setAuthCookies(res, result.accessToken, result.refreshToken)
    return { success: true, mustChangePassword: result.mustChangePassword }
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
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async webLogout(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const refreshToken = req.cookies?.goferbot_refreshToken
    if (refreshToken) {
      await this.authService.logoutByRefreshToken(refreshToken)
    }
    this.cookieHelper.clearAuthCookies(res)
    return { success: true }
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async changePassword(@CurrentUser('id') userId: string, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(userId, dto.currentPassword, dto.newPassword)
  }

  @Post('change-password/force')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async changePasswordForce(@CurrentUser('id') userId: string, @Body() dto: ChangePasswordForceDto) {
    return this.authService.changePasswordForce(userId, dto.newPassword)
  }

  @Post('admin/logout')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async adminLogout(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const refreshToken = req.cookies?.goferbot_refreshToken
    if (refreshToken) {
      await this.authService.logoutByRefreshToken(refreshToken)
    }
    this.cookieHelper.clearAuthCookies(res)
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

    if (!AVATAR_ALLOWED_MIME_TYPES.includes(data.mimetype)) {
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
