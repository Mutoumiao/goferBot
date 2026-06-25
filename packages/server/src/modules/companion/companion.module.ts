import { Module } from '@nestjs/common';
import { LlmConfigService } from './config/llm-config.service.js';

@Module({
  imports: [],
  controllers: [],
  providers: [LlmConfigService],
  exports: [LlmConfigService],
})
export class CompanionModule {}
