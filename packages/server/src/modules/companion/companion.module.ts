import { Module } from '@nestjs/common'
import { SettingsModule } from '../settings/settings.module.js'
import { SseResponseHelper } from '../../common/helpers/sse-response.helper.js'
import { CompanionController } from './companion.controller.js'
import { CompanionChatController } from './companion-chat.controller.js'
import { CompanionChatService } from './companion-chat.service.js'
import { LlmConfigService } from './config/llm-config.service.js'
import { LangChainLlmService } from './langchain/langchain-llm.service.js'
import { StructuredOutputService } from './langchain/structured-output.service.js'
import { CompanionGraphService } from './langgraph/graph.js'
import {
  EmotionNode,
  GenerateNode,
  IntentNode,
  MemoryCandidateNode,
  MemoryExtractionNode,
  PolicyNode,
  QualityGuardNode,
  RelationshipStageNode,
  RouteNode,
  SafetyNode,
  SharedNodeFactory,
  SummaryNode,
} from './langgraph/nodes/index.js'
import { CompanionRepository } from './repositories/companion.repository.js'
import { CompanionConversationRepository } from './repositories/companion-conversation.repository.js'
import { CompanionFeedbackRepository } from './repositories/companion-feedback.repository.js'
import { CompanionMemoryRepository } from './repositories/companion-memory.repository.js'
import { CompanionMessageRepository } from './repositories/companion-message.repository.js'

@Module({
  imports: [SettingsModule],
  controllers: [CompanionChatController, CompanionController],
  providers: [
    LlmConfigService,
    LangChainLlmService,
    StructuredOutputService,
    SharedNodeFactory,
    SafetyNode,
    IntentNode,
    EmotionNode,
    RelationshipStageNode,
    RouteNode,
    PolicyNode,
    GenerateNode,
    QualityGuardNode,
    MemoryCandidateNode,
    MemoryExtractionNode,
    SummaryNode,
    CompanionGraphService,
    CompanionChatService,
    SseResponseHelper,
    CompanionRepository,
    CompanionConversationRepository,
    CompanionMemoryRepository,
    CompanionMessageRepository,
    CompanionFeedbackRepository,
  ],
  exports: [
    LlmConfigService,
    LangChainLlmService,
    StructuredOutputService,
    SharedNodeFactory,
    SafetyNode,
    IntentNode,
    EmotionNode,
    RelationshipStageNode,
    RouteNode,
    PolicyNode,
    GenerateNode,
    QualityGuardNode,
    MemoryCandidateNode,
    MemoryExtractionNode,
    SummaryNode,
    CompanionGraphService,
    CompanionChatService,
    CompanionRepository,
    CompanionConversationRepository,
    CompanionMemoryRepository,
    CompanionMessageRepository,
    CompanionFeedbackRepository,
  ],
})
export class CompanionModule {}
