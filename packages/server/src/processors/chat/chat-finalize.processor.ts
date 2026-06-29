import { Injectable, Logger } from '@nestjs/common'
import type { Job } from 'bullmq'
import { RequestContextStorage } from '../../common/request-context-storage.js'
import { withTrace } from '../../common/utils/with-trace.js'
import { ConversationService } from '../../modules/chat/conversation.service.js'
import { LlmProviderFactory } from '../../modules/chat/llm/llm-provider.factory.js'
import type { LlmProvider } from '../../modules/chat/llm/llm-provider.interface.js'
import { ModelRegistryService } from '../../modules/chat/model-registry.service.js'
import type { ChatFinalizeJobData } from '../../queue/index.js'

const TITLE_DEFAULT_PROVIDER_ID = 'default'

@Injectable()
export class ChatFinalizeProcessor {
  private readonly logger = new Logger(ChatFinalizeProcessor.name)

  constructor(
    private readonly conversationService: ConversationService,
    private readonly modelRegistry: ModelRegistryService,
    private readonly llmProviderFactory: LlmProviderFactory,
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
        const provider = this.resolveTitleProvider(userId)
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

  private resolveTitleProvider(_userId?: string): LlmProvider | null {
    const info = this.modelRegistry.lookup(TITLE_DEFAULT_PROVIDER_ID)
    if (!info) return null
    return this.llmProviderFactory.create(info.providerKey, {
      apiKey: '',
      model: info.providerKey,
      baseURL: info.baseUrl,
      timeout: 30_000,
    })
  }
}
