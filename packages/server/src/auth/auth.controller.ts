import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { AllowApp, Public } from '../common/decorators/allow-app.decorator.js'
import { AuthService } from './auth.service.js'
import { ADMIN_REFRESH_COOKIE, CookieHelper, WEB_REFRESH_COOKIE } from './cookie.helper.js'
import { PasswordEncryptionService } from './crypto/password-encryption.service.js'
import { CurrentUser } from './decorators/current-user.decorator.js'
import { AdminLoginDto } from './dto/admin-login.dto.js'
import { validatePassword } from './dto/password.schema.js'
import { RegisterDto } from './dto/register.dto.js'
import { VerifyPasswordDto } from './dto/verify-password.dto.js'
import { WebLoginDto } from './dto/web-login.dto.js'
import { JwtAuthGuard } from './guards/jwt.guard.js'
import type { AuthApp } from './types/auth-app.type.js'

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordEncryption: PasswordEncryptionService,
    private readonly cookieHelper: CookieHelper,
  ) {}

  @Public()
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

  @Public()
  @Post('web/register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async webRegister(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: FastifyReply,
    @Req() req: FastifyRequest,
  ) {
    const password = this.decryptAndValidate(dto.encryptedPassword)
    const userAgent = req.headers['user-agent']
    const ip = req.ip
    const result = await this.authService.webRegister(
      dto.email,
      password,
      dto.invitationCode,
      dto.name,
      { userAgent, ip },
    )
    this.cookieHelper.setAuthCookies(res, result.accessToken, result.refreshToken, 'web')
    return { user: result.user }
  }

  @Public()
  @Post('web/login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async webLogin(
    @Body() dto: WebLoginDto,
    @Res({ passthrough: true }) res: FastifyReply,
    @Req() req: FastifyRequest,
  ) {
    const password = this.decryptAndValidate(dto.encryptedPassword)
    const userAgent = req.headers['user-agent']
    const ip = req.ip
    const result = await this.authService.webLogin(dto.email, password, { userAgent, ip })
    this.cookieHelper.setAuthCookies(res, result.accessToken, result.refreshToken, 'web')
    return { user: result.user }
  }

  @Public()
  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  async adminLogin(
    @Body() dto: AdminLoginDto,
    @Res({ passthrough: true }) res: FastifyReply,
    @Req() req: FastifyRequest,
  ) {
    const password = this.decryptAndValidate(dto.encryptedPassword)
    const userAgent = req.headers['user-agent']
    const ip = req.ip
    const result = await this.authService.adminLogin(dto.email, password, { userAgent, ip })
    this.cookieHelper.setAuthCookies(res, result.accessToken, result.refreshToken, 'admin')
    return { user: result.user }
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

  @Public()
  @Post('web/refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async webRefresh(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    return this.handleRefresh('web', req, res)
  }

  @Public()
  @Post('admin/refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async adminRefresh(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    return this.handleRefresh('admin', req, res)
  }

  private async handleRefresh(app: AuthApp, req: FastifyRequest, res: FastifyReply) {
    const refreshCookieName = app === 'admin' ? ADMIN_REFRESH_COOKIE : WEB_REFRESH_COOKIE
    const refreshToken = req.cookies?.[refreshCookieName]
    if (!refreshToken) {
      this.cookieHelper.clearAuthCookies(res, app)
      throw new BadRequestException({ code: 'REFRESH_TOKEN_MISSING', message: '未找到刷新令牌' })
    }
    try {
      const result = await this.authService.refresh(app, refreshToken)
      this.cookieHelper.setAuthCookies(res, result.accessToken, result.refreshToken, app)
      return { success: true }
    } catch (err) {
      this.cookieHelper.clearAuthCookies(res, app)
      throw err
    }
  }

  @Post('web/logout')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async webLogout(
    @CurrentUser('sessionId') sessionId: string,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    await this.authService.logout(sessionId, res, 'web')
    return { success: true }
  }

  @Post('admin/logout')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async adminLogout(
    @CurrentUser('sessionId') sessionId: string,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    await this.authService.logout(sessionId, res, 'admin')
    return { success: true }
  }

  @AllowApp('both')
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: { id: string; app: AuthApp }) {
    return this.authService.me(user.id, user.app)
  }

  @AllowApp('both')
  @Post('verify-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async verifyPassword(@CurrentUser('id') userId: string, @Body() dto: VerifyPasswordDto) {
    const valid = await this.authService.verifyPassword(userId, dto.password)
    return { success: valid }
  }
}
