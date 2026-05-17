import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../../auth/guards/jwt.guard.js'
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { SettingsService } from './settings.service.js'
import { SettingsDto, settingsSchema } from './dto/settings.dto.js'

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getSettings(@CurrentUser('id' as never) userId: string) {
    return this.settingsService.getSettings(userId)
  }

  @Post()
  async saveSettings(
    @CurrentUser('id' as never) userId: string,
    @Body(new ZodValidationPipe(settingsSchema)) dto: SettingsDto,
  ) {
    return this.settingsService.saveSettings(userId, dto)
  }
}
