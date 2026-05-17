import { Controller, Post, Get, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common'
import { AuthService } from './auth.service.js'
import { JwtAuthGuard } from './guards/jwt.guard.js'
import { CurrentUser } from './decorators/current-user.decorator.js'
import { LoginDto } from './dto/login.dto.js'
import { RegisterDto } from './dto/register.dto.js'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.email, dto.password, dto.name)
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password)
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
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
