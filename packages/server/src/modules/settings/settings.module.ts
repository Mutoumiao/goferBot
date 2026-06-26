import { Module } from '@nestjs/common'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { ConfigCryptoService } from './config-crypto.service.js'
import { ModelProviderService } from './model-provider.service.js'
import { SettingsController } from './settings.controller.js'
import { SettingsService } from './settings.service.js'
import { SystemConfigController } from './system-config.controller.js'
import { SystemConfigService } from './system-config.service.js'

@Module({
  imports: [EventEmitterModule.forRoot()],
  controllers: [SettingsController, SystemConfigController],
  providers: [SettingsService, ConfigCryptoService, SystemConfigService, ModelProviderService],
  exports: [SettingsService, SystemConfigService, ModelProviderService],
})
export class SettingsModule {}
