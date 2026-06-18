import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js'
import { JwtAuthGuard } from '../../auth/guards/jwt.guard.js'
import { SettingsDto } from './dto/settings.dto.js'
import { SettingsService } from './settings.service.js'

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getSettings(@CurrentUser('id') userId: string) {
    return this.settingsService.getSettings(userId)
  }

  @Post()
  @HttpCode(200)
  async saveSettings(@CurrentUser('id') userId: string, @Body() dto: SettingsDto) {
    return this.settingsService.saveSettings(userId, dto)
  }
}
