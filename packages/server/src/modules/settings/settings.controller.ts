import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common'
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js'
import { JwtAuthGuard } from '../../auth/guards/jwt.guard.js'
import { SETTING_CATEGORIES, type SettingCategory } from './constants.js'
import type { ModelProvider } from './dto/settings.dto.js'
import {
  AppearanceSettingsDto,
  ChatSettingsDto,
  CompanionSettingsDto,
  IndexingSettingsDto,
  RagSettingsDto,
  type Settings,
  SettingsDto,
} from './dto/settings.dto.js'
import { SettingsService } from './settings.service.js'

type CategoryDtoMap = {
  chat: ChatSettingsDto
  rag: RagSettingsDto
  companion: CompanionSettingsDto
  indexing: IndexingSettingsDto
  appearance: AppearanceSettingsDto
}

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getSettings(@CurrentUser('id') userId: string): Promise<Settings> {
    return this.settingsService.getSettings(userId)
  }

  @Get('providers')
  async getProviders(@CurrentUser('id') userId: string): Promise<ModelProvider[]> {
    const settings = await this.settingsService.getSettings(userId)
    return Object.values(settings.providers).filter((p) => p.enabled)
  }

  @Get(':category')
  async getCategory(
    @CurrentUser('id') userId: string,
    @Param('category') category: SettingCategory,
  ): Promise<Settings[SettingCategory]> {
    this.validateCategory(category)
    return this.settingsService.getCategory(userId, category)
  }

  @Post()
  @HttpCode(200)
  async saveSettings(
    @CurrentUser('id') userId: string,
    @Body() dto: SettingsDto,
  ): Promise<Settings> {
    return this.settingsService.saveSettings(userId, dto)
  }

  @Post(':category')
  @HttpCode(200)
  async saveCategory(
    @CurrentUser('id') userId: string,
    @Param('category') category: SettingCategory,
    @Body() dto: CategoryDtoMap[SettingCategory],
  ): Promise<Settings> {
    this.validateCategory(category)
    return this.settingsService.saveCategory(
      userId,
      category,
      dto as CategoryDtoMap[SettingCategory],
    )
  }

  private validateCategory(category: string): asserts category is SettingCategory {
    if (!SETTING_CATEGORIES.includes(category as SettingCategory)) {
      throw new BadRequestException({
        code: 'INVALID_CONFIG_CATEGORY',
        message: `无效配置分类: ${category}，允许: ${SETTING_CATEGORIES.join(', ')}`,
      })
    }
  }
}
