import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { StorageService } from './storage.service.js'
import { STORAGE_PROVIDER, storageProvider } from './storage.provider.js'

@Global()
@Module({
  imports: [ConfigModule],
  providers: [storageProvider, StorageService],
  exports: [StorageService],
})
export class StorageModule {}
