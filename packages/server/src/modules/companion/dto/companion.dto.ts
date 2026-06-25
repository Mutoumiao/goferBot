import {
  companionListQuerySchema,
  companionMessageListQuerySchema,
  conversationListQuerySchema,
  createCompanionSchema,
  createConversationSchema,
  createFeedbackSchema,
  createMemorySchema,
  memoryListQuerySchema,
  sendMessageSchema,
  updateCompanionSchema,
} from '@goferbot/data/schemas'
import { createZodDto } from 'nestjs-zod'

export class CreateCompanionDto extends createZodDto(createCompanionSchema) {}
export class UpdateCompanionDto extends createZodDto(updateCompanionSchema) {}
export class CompanionListQueryDto extends createZodDto(companionListQuerySchema) {}

export class CreateConversationDto extends createZodDto(createConversationSchema) {}
export class ConversationListQueryDto extends createZodDto(conversationListQuerySchema) {}

export class SendMessageDto extends createZodDto(sendMessageSchema) {}
export class MessageListQueryDto extends createZodDto(companionMessageListQuerySchema) {}

export class CreateMemoryDto extends createZodDto(createMemorySchema) {}
export class MemoryListQueryDto extends createZodDto(memoryListQuerySchema) {}

export class CreateFeedbackDto extends createZodDto(createFeedbackSchema) {}
