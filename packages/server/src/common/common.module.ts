import { Global, Module } from '@nestjs/common'
import { StreamFinalizeService } from './services/stream-finalize.service.js'
import { TraceContextService } from './services/trace-context.service.js'

@Global()
@Module({
  providers: [StreamFinalizeService, TraceContextService],
  exports: [StreamFinalizeService, TraceContextService],
})
export class CommonModule {}
