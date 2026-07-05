import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { Public } from '../../common/decorators/public.decorator.js'
import { AuthService } from '../auth.service.js'
import { CookieHelper } from '../cookie.helper.js'
import { PasswordEncryptionService } from '../crypto/password-encryption.service.js'
import { CurrentUser } from '../decorators/current-user.decorator.js'
import { AdminLoginDto } from '../dto/admin-login.dto.js'
import { validatePassword } from '../dto/password.schema.js'
import { JwtAuthGuard } from '../guards/jwt.guard.js'

@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordEncryption: PasswordEncryptionService,
    private readonly cookieHelper: CookieHelper,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  async login(
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

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async refresh(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    return this.authService.refreshToken('admin', req, res)
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async logout(
    @CurrentUser('sessionId') sessionId: string,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    await this.authService.logout(sessionId, res, 'admin')
    return { success: true }
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
}
