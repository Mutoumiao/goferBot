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
import { validatePassword } from '../dto/password.schema.js'
import { RegisterDto } from '../dto/register.dto.js'
import { WebLoginDto } from '../dto/web-login.dto.js'
import { JwtAuthGuard } from '../guards/jwt.guard.js'

@Controller('web/auth')
export class WebAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordEncryption: PasswordEncryptionService,
    private readonly cookieHelper: CookieHelper,
  ) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async register(
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
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async login(
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
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async refresh(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    return this.authService.refreshToken('web', req, res)
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async logout(
    @CurrentUser('sessionId') sessionId: string,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    await this.authService.logout(sessionId, res, 'web')
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
