import { Injectable, Logger } from '@nestjs/common'
import type { Job } from 'bullmq'
import { RequestContextStorage } from '../../common/request-context-storage.js'
import { withTrace } from '../../common/utils/with-trace.js'
import { ConversationService } from '../../modules/chat/conversation.service.js'
import { LangChainLlmProvider } from '../../modules/chat/llm/langchain-llm-provider.service.js'
import type { LlmProvider } from '../../modules/chat/llm/llm-provider.interface.js'
import type { ModelProvider } from '../../modules/settings/dto/settings.dto.js'
import { parseModelKey } from '../../modules/settings/model-provider.service.js'
import { ProviderRegistry } from '../../modules/settings/providers/index.js'
import { SystemConfigService } from '../../modules/settings/system-config.service.js'
import type { ChatFinalizeJobData } from '../../queue/index.js'

const TITLE_PROVIDER_TIMEOUT_MS = 30_000
const TITLE_PROVIDER_SCOPE = 'llm'

@Injectable()
export class ChatFinalizeProcessor {
  private readonly logger = new Logger(ChatFinalizeProcessor.name)

  constructor(
    private readonly conversationService: ConversationService,
    private readonly systemConfigService: SystemConfigService,
    private readonly providerRegistry: ProviderRegistry,
  ) {}

  async process(job: Job<ChatFinalizeJobData>): Promise<void> {
    const { sessionId, userId, fullReply, input, traceId, requestId } = job.data

    this.logger.log(
      withTrace(`[chat-finalize] started jobId=${job.id} sessionId=${sessionId}`, {
        traceId,
        requestId,
        userId,
        sessionId,
      }),
    )

    await RequestContextStorage.run({ traceId, requestId, userId }, async () => {
      try {
        await this.conversationService.saveAssistantMessage(
          sessionId,
          job.data.messageId,
          fullReply,
        )
        this.logger.log(
          withTrace(`[chat-finalize] message persisted jobId=${job.id}`, {
            sessionId,
          }),
        )
      } catch (err) {
        this.logger.error(
          withTrace(`[chat-finalize] persist failed jobId=${job.id}`, {
            sessionId,
            error: err instanceof Error ? err.message : String(err),
          }),
        )
        throw err
      }

      try {
        const provider = await this.resolveTitleProvider({ traceId, requestId, sessionId })
        if (provider) {
          await this.conversationService.generateTitle(sessionId, input, fullReply, provider)
        }
        this.logger.log(
          withTrace(`[chat-finalize] title generated jobId=${job.id}`, {
            sessionId,
          }),
        )
      } catch (err) {
        this.logger.error(
          withTrace(`[chat-finalize] title generation failed jobId=${job.id}`, {
            sessionId,
            error: err instanceof Error ? err.message : String(err),
          }),
        )
      }
    })
  }

  private async resolveTitleProvider(ctx: {
    traceId?: string
    requestId?: string
    sessionId?: string
  }): Promise<LlmProvider | null> {
    const config = await this.systemConfigService.getDecryptedSystemConfig()

    const preferredId = config.chat.defaultProvider
    const enabledIds = config.chat.enabledProviders ?? []

    const candidateIds = [
      ...(preferredId && enabledIds.includes(preferredId) ? [preferredId] : []),
      ...enabledIds.filter((id) => id !== preferredId),
    ]

    for (const key of candidateIds) {
      const { providerId, modelName } = parseModelKey(key)
      const provider = config.providers[providerId]
      if (!provider?.enabled) continue

      const model = modelName
        ? provider.models.find((m) => m.name === modelName && m.type === TITLE_PROVIDER_SCOPE)
        : provider.models.find((m) => m.type === TITLE_PROVIDER_SCOPE && m.enabled)
      if (!model?.enabled) continue
      if (!provider.apiKey) {
        this.logger.warn(
          withTrace(`[chat-finalize] title provider ${providerId} missing apiKey, skipping`, ctx),
        )
        continue
      }
      try {
        return await this.createLlmProvider(provider, model.name)
      } catch (err) {
        this.logger.warn(
          withTrace(
            `[chat-finalize] title provider ${providerId} init failed: ${err instanceof Error ? err.message : String(err)}`,
            ctx,
          ),
        )
      }
    }

    this.logger.warn(
      withTrace(
        `[chat-finalize] no usable title provider configured (defaultProvider=${preferredId ?? 'none'}, enabledProviders=${enabledIds.join(',') || 'empty'})`,
        ctx,
      ),
    )
    return null
  }

  private async createLlmProvider(provider: ModelProvider, modelName: string): Promise<LlmProvider> {
    const baseProvider = await this.providerRegistry.get(provider.id, modelName)
    return new LangChainLlmProvider(baseProvider.toLangChain())
  }
}
