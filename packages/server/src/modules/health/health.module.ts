import { Module } from '@nestjs/common'
import { AuthModule } from '../../auth/auth.module.js'
import { DatabaseModule } from '../../processors/database/database.module.js'
import { storageProvider } from '../../processors/storage/storage.provider.js'
import { HealthController } from './health.controller.js'
import { HealthService } from './health.service.js'

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [HealthController],
  providers: [HealthService, storageProvider],
  exports: [HealthService],
})
export class HealthModule {}
