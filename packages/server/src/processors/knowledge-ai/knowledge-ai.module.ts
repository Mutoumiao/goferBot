import { Global, Module } from '@nestjs/common'
import { SettingsModule } from '../../modules/settings/settings.module.js'
import { KnowledgeAiClient } from './knowledge-ai.client.js'
import { KnowledgeAiProviderResolver } from './knowledge-ai.provider-resolver.js'

@Global()
@Module({
  imports: [SettingsModule],
  providers: [KnowledgeAiClient, KnowledgeAiProviderResolver],
  exports: [KnowledgeAiClient, KnowledgeAiProviderResolver],
})
export class KnowledgeAiModule {}
