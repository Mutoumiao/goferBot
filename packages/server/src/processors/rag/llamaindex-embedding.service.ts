import { BaseEmbedding } from '@llamaindex/core/embeddings'
import { OpenAIEmbedding } from '@llamaindex/openai'
import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { ConfigChangedEvent, MODEL_PROVIDER_ERROR_CODES } from '../../modules/settings/constants.js'
import type { ResolvedProvider, Settings } from '../../modules/settings/dto/settings.dto.js'
import { ModelProviderService } from '../../modules/settings/model-provider.service.js'
import { SystemConfigService } from '../../modules/settings/system-config.service.js'

/**
 * 根据 isCompleteUrl 解析 Embedding baseURL。
 * - false（默认）：baseUrl 是 API 网关地址，SDK 自动拼 /embeddings
 * - true：baseUrl 是完整请求地址，strip /embeddings 后缀供 SDK 重新拼接
 */
function resolveEmbeddingBaseURL(baseUrl: string, isCompleteUrl: boolean): string | undefined {
  if (!baseUrl) return undefined
  if (!isCompleteUrl) return baseUrl
  // ponytail: strip 已知端点后缀，SDK 会重新拼接
  return baseUrl.replace(/\/embeddings$/, '')
}

@Injectable()
export class LlamaIndexEmbeddingService implements OnModuleInit {
  private readonly logger = new Logger(LlamaIndexEmbeddingService.name)
  private modelInstance: BaseEmbedding | null = null
  private dimensions: number | undefined = undefined

  constructor(
    private readonly systemConfigService: SystemConfigService,
    private readonly modelProviderService: ModelProviderService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refreshConfig()
  }

  @OnEvent('config.changed')
  async handleConfigChanged(event: ConfigChangedEvent): Promise<void> {
    if (event.category === 'rag' || event.category === 'providers') {
      await this.refreshConfig()
    }
  }

  async reload(): Promise<void> {
    await this.refreshConfig()
  }

  private async refreshConfig(): Promise<void> {
    const config = await this.systemConfigService.getDecryptedSystemConfig()
    this.modelInstance = null
    this.dimensions = undefined

    const provider = this.tryResolveProvider(config)
    if (!provider) {
      this.logger.warn('Embedding 未配置：请在管理后台配置 rag.embeddingProvider')
      return
    }

    this.dimensions = provider.dimensions

    if (!provider.apiKey) {
      this.logger.warn('Embedding 未配置：缺少 API Key')
      return
    }

    this.modelInstance = new OpenAIEmbedding({
      model: provider.model,
      apiKey: provider.apiKey,
      baseURL: resolveEmbeddingBaseURL(provider.baseUrl, provider.isCompleteUrl),
      dimensions: provider.dimensions,
    })
    this.logger.debug(`Embedding model refreshed: ${provider.model}`)
  }

  private tryResolveProvider(config: Settings): ResolvedProvider | null {
    if (!config.rag.embeddingProvider) return null
    try {
      return this.modelProviderService.resolveProvider('rag.embeddingProvider', 'embedding', config)
    } catch {
      return null
    }
  }

  private getModel(): BaseEmbedding {
    if (!this.modelInstance) {
      throw new BadRequestException({
        code: MODEL_PROVIDER_ERROR_CODES.NOT_CONFIGURED,
        message: 'Embedding 未配置：请在管理后台配置 rag.embeddingProvider',
      })
    }
    return this.modelInstance
  }

  getDimensions(): number | undefined {
    return this.dimensions
  }

  async embed(text: string): Promise<number[]> {
    return this.getModel().getTextEmbedding(text)
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return this.getModel().getTextEmbeddings(texts)
  }
}
