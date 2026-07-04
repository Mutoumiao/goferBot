import { Module } from '@nestjs/common'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { AuthModule } from '../../auth/auth.module.js'
import { PermissionModule } from '../permission/permission.module.js'
import { ConfigCryptoService } from './config-crypto.service.js'
import { ModelProviderService } from './model-provider.service.js'
import { SettingsController } from './settings.controller.js'
import { SettingsService } from './settings.service.js'
import { SystemConfigController } from './system-config.controller.js'
import { SystemConfigService } from './system-config.service.js'

@Module({
  imports: [EventEmitterModule.forRoot(), AuthModule, PermissionModule],
  controllers: [SettingsController, SystemConfigController],
  providers: [SettingsService, ConfigCryptoService, SystemConfigService, ModelProviderService],
  exports: [SettingsService, SystemConfigService, ModelProviderService],
})
export class SettingsModule {}
