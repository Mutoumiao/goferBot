import { forwardRef, Module } from '@nestjs/common'
import { SseResponseHelper } from '../../common/helpers/sse-response.helper.js'
import { LlamaIndexRagService } from '../../processors/rag/llamaindex-rag.service.js'
import { RagModule } from '../../processors/rag/rag.module.js'
import { SessionModule } from '../session/session.module.js'
import { SettingsModule } from '../settings/settings.module.js'
import { ChatController } from './chat.controller.js'
import { ChatService } from './chat.service.js'
import { ConversationService } from './conversation.service.js'
import { CHAT_CONTEXT_RETRIEVER } from './interfaces/chat-context-retriever.interface.js'
import { LlmProviderFactory } from './llm/llm-provider.factory.js'
import { ModelRegistryService } from './model-registry.service.js'

@Module({
  imports: [SettingsModule, SessionModule, forwardRef(() => RagModule)],
  controllers: [ChatController],
  providers: [
    ChatService,
    ConversationService,
    LlmProviderFactory,
    ModelRegistryService,
    SseResponseHelper,
    {
      provide: CHAT_CONTEXT_RETRIEVER,
      inject: [LlamaIndexRagService],
      useFactory: async (ragService: LlamaIndexRagService) => ({
        async retrieve(query: string, opts: { kbIds?: string[]; userId?: string }) {
          const chunks = await ragService.retrieve(query, {
            kbIds: opts.kbIds,
            userId: opts.userId,
            mode: 'hybrid',
          })
          return { context: chunks.map((c) => c.content).join('\n\n') }
        },
      }),
    },
  ],
  exports: [ConversationService, LlmProviderFactory, ModelRegistryService],
})
export class ChatModule {}
