import { Global, Module } from '@nestjs/common'
import { VectorService } from './vector.service.js'

@Global()
@Module({
  providers: [VectorService],
  exports: [VectorService],
})
export class VectorModule {}
