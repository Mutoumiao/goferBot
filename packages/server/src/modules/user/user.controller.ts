import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { FastifyRequest } from 'fastify'
import { AuthService } from '../../auth/auth.service.js'
import { AVATAR_ALLOWED_MIME_TYPES } from '../../auth/constants.js'
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js'
import { ChangePasswordDto } from '../../auth/dto/change-password.dto.js'
import { UpdateProfileDto } from '../../auth/dto/update-profile.dto.js'
import { JwtAuthGuard } from '../../auth/guards/jwt.guard.js'
import type { AuthApp } from '../../auth/types/auth-app.type.js'
import { AllowApp } from '../../common/decorators/allow-app.decorator.js'
import { UserService } from './user.service.js'

@Controller('user')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
  ) {}

  @AllowApp('both')
  @Get('me')
  async getMe(@CurrentUser() user: { id: string; app: AuthApp }) {
    return this.authService.me(user.id, user.app)
  }

  @AllowApp('both')
  @Patch('me')
  async updateMe(@CurrentUser() user: { id: string; app: AuthApp }, @Body() dto: UpdateProfileDto) {
    await this.userService.updateName(user.id, dto.name)
    return this.authService.me(user.id, user.app)
  }

  @AllowApp('both')
  @Post('avatar')
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

    const avatarUrl = `avatar:${buffer.toString('base64').slice(0, 32)}`
    await this.userService.updateAvatar(userId, avatarUrl)
    return { avatar: avatarUrl }
  }

  @AllowApp('both')
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async changePassword(
    @CurrentUser('id') userId: string,
    @CurrentUser('sessionId') sessionId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(sessionId, userId, dto.currentPassword, dto.newPassword)
  }

  @AllowApp('both')
  @Get('sessions')
  async getSessions(@CurrentUser('id') userId: string) {
    return this.authService.getAllSessions(userId)
  }

  @AllowApp('both')
  @Delete('sessions/:id')
  @HttpCode(HttpStatus.OK)
  async revokeSession(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) sessionId: string,
  ) {
    await this.authService.revokeSession(userId, sessionId)
    return { success: true }
  }

  @AllowApp('both')
  @Post('sessions/revoke-all')
  @HttpCode(HttpStatus.OK)
  async revokeAllSessions(@CurrentUser('id') userId: string) {
    await this.authService.revokeAllSessions(userId)
    return { success: true }
  }

  @AllowApp('both')
  @Post('sessions/revoke-others')
  @HttpCode(HttpStatus.OK)
  async revokeOtherSessions(
    @CurrentUser('id') userId: string,
    @CurrentUser('sessionId') sessionId: string,
  ) {
    await this.authService.revokeOtherSessions(userId, sessionId)
    return { success: true }
  }
}
