import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { Public } from '../common/decorators/public.decorator.js'
import { AuthService } from './auth.service.js'
import { PasswordEncryptionService } from './crypto/password-encryption.service.js'
import { CurrentUser } from './decorators/current-user.decorator.js'
import { VerifyPasswordDto } from './dto/verify-password.dto.js'
import { JwtAuthGuard } from './guards/jwt.guard.js'
import type { AuthApp } from './types/auth-app.type.js'

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordEncryption: PasswordEncryptionService,
  ) { }

  @Public()
  @Get('public-key')
  @Throttle({ default: { ttl: 60000, limit: 60 } })
  getPublicKey() {
    return {
      publicKey: this.passwordEncryption.getPublicKeyPem(),
      algorithm: 'RSA-OAEP',
      hash: 'SHA-256',
    }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: { id: string; app: AuthApp }) {
    return this.authService.me(user.id, user.app)
  }

  @Post('verify-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async verifyPassword(@CurrentUser('id') userId: string, @Body() dto: VerifyPasswordDto) {
    const valid = await this.authService.verifyPassword(userId, dto.password)
    return { success: valid }
  }
}
