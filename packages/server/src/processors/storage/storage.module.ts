import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { STORAGE_PROVIDER, storageProvider } from './storage.provider.js'
import { StorageService } from './storage.service.js'

@Global()
@Module({
  imports: [ConfigModule],
  providers: [storageProvider, StorageService],
  exports: [StorageService],
})
export class StorageModule {}
