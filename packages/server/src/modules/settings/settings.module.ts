import { Module } from '@nestjs/common'
import { SettingsController } from './settings.controller.js'
import { SettingsService } from './settings.service.js'
import { ConfigCryptoService } from './config-crypto.service.js'

@Module({
  controllers: [SettingsController],
  providers: [SettingsService, ConfigCryptoService],
  exports: [SettingsService],
})
export class SettingsModule {}
