import { Global, Module } from '@nestjs/common'
import { KeywordService } from './keyword.service.js'

@Global()
@Module({
  providers: [KeywordService],
  exports: [KeywordService],
})
export class KeywordModule {}
