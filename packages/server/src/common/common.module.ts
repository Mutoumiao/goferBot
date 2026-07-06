import { Global, Module } from '@nestjs/common'
import { StreamFinalizeService } from './services/stream-finalize.service.js'

@Global()
@Module({
  providers: [StreamFinalizeService],
  exports: [StreamFinalizeService],
})
export class CommonModule {}
