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

  @Get(':category')
  async getCategory(
    @CurrentUser('id') userId: string,
    @Param('category') category: SettingCategory,
  ): Promise<Settings[SettingCategory]> {
    this.validateCategory(category)
    return this.settingsService.getCategory(userId, category)
  }

  @Get(':category/providers')
  async getAvailableProviders(
    @CurrentUser('id') userId: string,
    @Param('category') category: SettingCategory,
  ): Promise<{ builtIn: ModelProvider[]; custom: ModelProvider[] }> {
    this.validateCategory(category)
    if (!['chat', 'rag', 'companion'].includes(category)) {
      throw new BadRequestException({
        code: 'INVALID_PROVIDER_CATEGORY',
        message: `该分类不支持读取可用模型: ${category}`,
      })
    }
    return this.settingsService.getAvailableProviders(userId, category)
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
    if (category !== 'appearance') {
      throw new BadRequestException({
        code: 'CATEGORY_READ_ONLY',
        message: `用户端不允许修改分类: ${category}，请通过管理后台配置`,
      })
    }
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
