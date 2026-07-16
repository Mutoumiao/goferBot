import { Module } from '@nestjs/common'
import { PermissionGuard } from '../../auth/guards/permission.guard.js'
import { SseResponseHelper } from '../../common/helpers/sse-response.helper.js'
import { StorageModule } from '../../processors/storage/storage.module.js'
import { PermissionModule } from '../permission/permission.module.js'
import { SettingsModule } from '../settings/settings.module.js'
import { CompanionAdminController } from './companion-admin.controller.js'
import { CompanionAdminService } from './companion-admin.service.js'
import { CompanionController } from './companion.controller.js'
import { CompanionService } from './companion.service.js'
import { CompanionCareService } from './companion-care.service.js'
import { CompanionChatController } from './companion-chat.controller.js'
import { CompanionChatService } from './companion-chat.service.js'
import { CompanionChatPipelineService } from './companion-chat-pipeline.service.js'
import { CompanionChatStreamService } from './companion-chat-stream.service.js'
import { CompanionMemoryService } from './companion-memory.service.js'
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
import { CompanionCareRepository } from './repositories/companion-care.repository.js'
import { CompanionConversationRepository } from './repositories/companion-conversation.repository.js'
import { CompanionFeedbackRepository } from './repositories/companion-feedback.repository.js'
import { CompanionMemoryRepository } from './repositories/companion-memory.repository.js'
import { CompanionMessageRepository } from './repositories/companion-message.repository.js'

@Module({
  imports: [SettingsModule, StorageModule, PermissionModule],
  controllers: [CompanionChatController, CompanionController, CompanionAdminController],
  providers: [
    CompanionAdminService,
    PermissionGuard,
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
    CompanionChatPipelineService,
    CompanionChatStreamService,
    CompanionService,
    CompanionCareService,
    CompanionMemoryService,
    SseResponseHelper,
    CompanionRepository,
    CompanionCareRepository,
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
    CompanionChatPipelineService,
    CompanionChatStreamService,
    CompanionService,
    CompanionAdminService,
    CompanionCareService,
    CompanionMemoryService,
    CompanionRepository,
    CompanionCareRepository,
    CompanionConversationRepository,
    CompanionMemoryRepository,
    CompanionMessageRepository,
    CompanionFeedbackRepository,
  ],
})
export class CompanionModule {}
