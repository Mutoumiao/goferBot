import { Module } from '@nestjs/common'
import { SseResponseHelper } from '../../common/helpers/sse-response.helper.js'
import { KnowledgeAiModule } from '../../processors/knowledge-ai/knowledge-ai.module.js'
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module.js'
import { SessionModule } from '../session/session.module.js'
import { SettingsModule } from '../settings/settings.module.js'
import { ChatController } from './chat.controller.js'
import { ChatService } from './chat.service.js'
import { ConversationService } from './conversation.service.js'
import { ModelRegistryService } from './model-registry.service.js'

@Module({
  imports: [SettingsModule, SessionModule, KnowledgeBaseModule, KnowledgeAiModule],
  controllers: [ChatController],
  providers: [ChatService, ConversationService, ModelRegistryService, SseResponseHelper],
  exports: [ConversationService, ModelRegistryService],
})
export class ChatModule {}
