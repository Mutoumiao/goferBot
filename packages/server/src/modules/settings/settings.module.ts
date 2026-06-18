import { Module } from '@nestjs/common'
import { ConfigCryptoService } from './config-crypto.service.js'
import { SettingsController } from './settings.controller.js'
import { SettingsService } from './settings.service.js'

@Module({
  controllers: [SettingsController],
  providers: [SettingsService, ConfigCryptoService],
  exports: [SettingsService],
})
export class SettingsModule {}
