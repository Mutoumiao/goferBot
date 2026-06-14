import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ChatController } from './chat.controller.js'
import { ChatInitController } from './chat.init.controller.js'
import { MessagesController } from './messages.controller.js'
import { ChatService } from './chat.service.js'
import { RagService } from './rag.service.js'
import { ModelRegistryService } from './model-registry.service.js'
import { HybridRetriever, DefaultRetrievalPostprocessor, OpenAIEmbedder } from '@goferbot/rag-sdk'
import { VectorService } from '../../processors/vector/vector.service.js'
import { KeywordService } from '../../processors/keyword/keyword.service.js'
import { SettingsModule } from '../settings/settings.module.js'
import { SessionModule } from '../session/session.module.js'

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
    defaultModels: ['deepseek-chat'],
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
      registry.register([{
        id: model,
        providerKey: provider.key,
        providerName: provider.name,
        baseUrl,
      }])
    }
  }

  return registry
}

@Module({
  imports: [SettingsModule, SessionModule],
  controllers: [ChatController, ChatInitController, MessagesController],
  providers: [
    ChatService,
    RagService,
    {
      provide: ModelRegistryService,
      useFactory: createModelRegistry,
      inject: [ConfigService],
    },
    {
      provide: HybridRetriever,
      useFactory: (vectorService: VectorService, keywordService: KeywordService, config: ConfigService) => {
        const embedder = new OpenAIEmbedder({
          provider: 'openai',
          apiKey: config.getOrThrow<string>('EMBEDDING_API_KEY'),
          baseUrl: config.get<string>('EMBEDDING_BASE_URL') ?? undefined,
          model: config.get<string>('EMBEDDING_MODEL', 'text-embedding-3-small'),
          dimension: config.get<number>('EMBEDDING_DIMENSIONS', 1536),
        })
        return new HybridRetriever({
          vectorStore: vectorService,
          keywordStore: keywordService,
          embedder,
        })
      },
      inject: [VectorService, KeywordService, ConfigService],
    },
    {
      provide: DefaultRetrievalPostprocessor,
      useValue: new DefaultRetrievalPostprocessor({ minScore: 0, maxChunks: 10, tokenBudget: 3000 }),
    },
  ],
  exports: [ModelRegistryService],
})
export class ChatModule { }
