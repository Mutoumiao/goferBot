import { Module } from '@nestjs/common'
import { LlmConfigService } from './config/llm-config.service.js'
import { LangChainLlmService } from './langchain/langchain-llm.service.js'
import { StructuredOutputService } from './langchain/structured-output.service.js'
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

@Module({
  imports: [],
  controllers: [],
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
    CompanionRepository,
    CompanionConversationRepository,
    CompanionMemoryRepository,
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
    CompanionRepository,
    CompanionConversationRepository,
    CompanionMemoryRepository,
    CompanionFeedbackRepository,
  ],
})
export class CompanionModule {}
