import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common'
import { RequirePermission } from '../../auth/decorators/permission.decorator.js'
import { JwtAuthGuard } from '../../auth/guards/jwt.guard.js'
import { PermissionGuard } from '../../auth/guards/permission.guard.js'
import { ConfigCryptoService } from './config-crypto.service.js'
import { SETTING_CATEGORIES, type SettingCategory } from './constants.js'
import type { ModelProvider } from './dto/settings.dto.js'
import {
  AppearanceSettingsDto,
  ChatSettingsDto,
  CompanionSettingsDto,
  FetchModelsDto,
  IndexingSettingsDto,
  ProviderDto,
  RagSettingsDto,
  type Settings,
} from './dto/settings.dto.js'
import { SystemConfigService } from './system-config.service.js'

type CategoryDtoMap = {
  chat: ChatSettingsDto
  rag: RagSettingsDto
  companion: CompanionSettingsDto
  indexing: IndexingSettingsDto
  appearance: AppearanceSettingsDto
}

@Controller('admin')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SystemConfigController {
  constructor(
    private readonly systemConfigService: SystemConfigService,
    private readonly crypto: ConfigCryptoService,
  ) {}

  // ==================== System-wide settings ====================

  @Get('system-config')
  @RequirePermission('moduleSettings:read')
  async getSystemConfig(): Promise<Settings> {
    return this.systemConfigService.getSystemConfig()
  }

  @Get('system-config/:category')
  @RequirePermission('moduleSettings:read')
  async getSystemCategory(
    @Param('category') category: SettingCategory,
  ): Promise<Settings[SettingCategory]> {
    this.validateCategory(category)
    return this.systemConfigService.getSystemCategory(category)
  }

  @Post('system-config/:category')
  @HttpCode(200)
  @RequirePermission('moduleSettings:update')
  async saveSystemCategory(
    @Param('category') category: SettingCategory,
    @Body() dto: CategoryDtoMap[SettingCategory],
  ): Promise<Settings> {
    this.validateCategory(category)
    return this.systemConfigService.saveSystemCategory(
      category,
      dto as CategoryDtoMap[SettingCategory],
    )
  }

  @Post('system-config/reload')
  @HttpCode(200)
  @RequirePermission('moduleSettings:update')
  async reloadModels(): Promise<{ success: boolean }> {
    await this.systemConfigService.reloadModels()
    return { success: true }
  }

  // ==================== Provider pool ====================

  @Get('providers')
  @RequirePermission('modelProviders:read')
  async listProviders(): Promise<Record<string, ModelProvider>> {
    const providers = await this.systemConfigService.getProviders()
    return this.maskProviders(providers)
  }

  @Get('providers/presets')
  @RequirePermission('modelProviders:read')
  getPresets() {
    return this.systemConfigService.getPresets()
  }

  @Post('providers/fetch-models')
  @HttpCode(200)
  @RequirePermission('modelProviders:create')
  async fetchModels(@Body() dto: FetchModelsDto) {
    return this.systemConfigService.fetchModels(dto)
  }

  @Get('providers/:id')
  @RequirePermission('modelProviders:read')
  async getProvider(@Param('id') id: string): Promise<ModelProvider> {
    const provider = await this.systemConfigService.getProvider(id)
    return this.maskProvider(provider)
  }

  @Post('providers')
  @HttpCode(200)
  @RequirePermission('modelProviders:create')
  async saveProvider(@Body() dto: ProviderDto): Promise<ModelProvider> {
    const provider = await this.systemConfigService.saveProvider(dto)
    return this.maskProvider(provider)
  }

  @Delete('providers/:id')
  @HttpCode(200)
  @RequirePermission('modelProviders:delete')
  async deleteProvider(@Param('id') id: string): Promise<{ success: boolean }> {
    await this.systemConfigService.deleteProvider(id)
    return { success: true }
  }

  private validateCategory(category: string): asserts category is SettingCategory {
    if (!SETTING_CATEGORIES.includes(category as SettingCategory)) {
      throw new BadRequestException({
        code: 'INVALID_CONFIG_CATEGORY',
        message: `无效配置分类: ${category}，允许: ${SETTING_CATEGORIES.join(', ')}`,
      })
    }
  }

  private maskProviders(providers: Record<string, ModelProvider>): Record<string, ModelProvider> {
    return this.crypto.maskObject(providers) as Record<string, ModelProvider>
  }

  private maskProvider(provider: ModelProvider): ModelProvider {
    return this.crypto.maskObject(provider) as ModelProvider
  }
}
