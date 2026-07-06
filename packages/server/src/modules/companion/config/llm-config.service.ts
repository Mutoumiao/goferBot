import { ChatOpenAI } from '@langchain/openai'
import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { resolveLlmBaseURL } from '../../chat/llm/llama-index-provider.service.js'
import { ConfigChangedEvent, MODEL_PROVIDER_ERROR_CODES } from '../../settings/constants.js'
import type { Settings } from '../../settings/dto/settings.dto.js'
import { ModelProviderService } from '../../settings/model-provider.service.js'
import { SystemConfigService } from '../../settings/system-config.service.js'

@Injectable()
export class LlmConfigService implements OnModuleInit {
  private readonly logger = new Logger(LlmConfigService.name)
  private companionConfig: Settings['companion'] | null = null
  private settings: Settings | null = null

  constructor(
    private readonly systemConfigService: SystemConfigService,
    private readonly modelProviderService: ModelProviderService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refreshConfig()
  }

  @OnEvent('config.changed')
  async handleConfigChanged(event: ConfigChangedEvent): Promise<void> {
    if (event.category === 'companion' || event.category === 'providers') {
      await this.refreshConfig()
    }
  }

  private async refreshConfig(): Promise<void> {
    const config = await this.systemConfigService.getDecryptedSystemConfig()
    this.companionConfig = config.companion
    this.settings = config
    const providerId = config.companion.provider
    this.logger.debug(`Companion LLM config refreshed: ${providerId ?? '未配置'}`)
  }

  private getLlmConfig(): { apiKey: string; model: string; baseURL?: string; timeout: number } {
    if (!this.settings || !this.companionConfig) {
      throw new BadRequestException({
        code: MODEL_PROVIDER_ERROR_CODES.NOT_CONFIGURED,
        message: 'Companion LLM 未配置：请先在管理后台配置 companion 模型',
      })
    }

    const provider = this.modelProviderService.resolveProvider(
      'companion.provider',
      'llm',
      this.settings,
    )

    if (!provider.apiKey) {
      throw new BadRequestException({
        code: MODEL_PROVIDER_ERROR_CODES.NOT_CONFIGURED,
        message: 'Companion LLM 未配置：缺少 API Key',
      })
    }

    return {
      apiKey: provider.apiKey,
      model: provider.model,
      baseURL: resolveLlmBaseURL(provider.baseUrl, provider.isCompleteUrl),
      timeout: provider.timeoutMs,
    }
  }

  createLangChainChatModel(
    overrides?: Partial<ConstructorParameters<typeof ChatOpenAI>[0]>,
  ): ChatOpenAI {
    const config = this.getLlmConfig()

    this.logger.debug(`Creating LangChain ChatOpenAI model: ${config.model}`)

    return new ChatOpenAI({
      apiKey: config.apiKey,
      model: config.model,
      ...(config.baseURL ? { configuration: { baseURL: config.baseURL } } : {}),
      timeout: config.timeout,
      ...overrides,
    })
  }
}
