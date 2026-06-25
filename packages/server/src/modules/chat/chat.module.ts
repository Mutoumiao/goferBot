import { forwardRef, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SseResponseHelper } from '../../common/helpers/sse-response.helper.js'
import { RagModule } from '../../processors/rag/rag.module.js'
import { LlamaIndexRagService } from '../../processors/rag/llamaindex-rag.service.js'
import { SessionModule } from '../session/session.module.js'
import { SettingsModule } from '../settings/settings.module.js'
import { ChatController } from './chat.controller.js'
import { ChatService } from './chat.service.js'
import { ConversationService } from './conversation.service.js'
import { CHAT_CONTEXT_RETRIEVER } from './interfaces/chat-context-retriever.interface.js'
import { LlmProviderFactory } from './llm/llm-provider.factory.js'
import { ModelRegistryService } from './model-registry.service.js'

interface BuiltinProviderConfig {
  key: string
  name: string
  envPrefix: string
  defaultBaseUrl: string
  defaultModels: string[]
}

const BUILTIN_CHAT_PROVIDERS: BuiltinProviderConfig[] = [
  {
    key: 'deepseek',
    name: 'DeepSeek',
    envPrefix: 'DEEPSEEK',
    defaultBaseUrl: 'https://api.deepseek.com',
    defaultModels: ['deepseek-v4-flash'],
  },
]

function createModelRegistry(config: ConfigService): ModelRegistryService {
  const registry = new ModelRegistryService()
  const enabledProviders = (config.get<string>('ENABLED_PROVIDERS') ?? 'deepseek')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  for (const provider of BUILTIN_CHAT_PROVIDERS) {
    if (!enabledProviders.includes(provider.key)) continue

    const apiKey = config.get<string>(`${provider.envPrefix}_API_KEY`)
    const baseUrl = config.get<string>(`${provider.envPrefix}_BASE_URL`) ?? provider.defaultBaseUrl
    if (!apiKey) continue

    for (const model of provider.defaultModels) {
      registry.register([
        {
          id: model,
          providerKey: provider.key,
          providerName: provider.name,
          baseUrl,
        },
      ])
    }
  }

  return registry
}

@Module({
  imports: [SettingsModule, SessionModule, forwardRef(() => RagModule)],
  controllers: [ChatController],
  providers: [
    ChatService,
    ConversationService,
    LlmProviderFactory,
    SseResponseHelper,
    {
      provide: ModelRegistryService,
      useFactory: createModelRegistry,
      inject: [ConfigService],
    },
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
  exports: [ModelRegistryService],
})
export class ChatModule {}
