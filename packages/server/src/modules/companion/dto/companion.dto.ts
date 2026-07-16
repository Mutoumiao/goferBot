import {
  companionListQuerySchema,
  companionMessageListQuerySchema,
  conversationListQuerySchema,
  createAdminCompanionSchema,
  createCompanionSchema,
  createConversationSchema,
  createFeedbackSchema,
  createMemorySchema,
  generateCareEventSchema,
  memoryListQuerySchema,
  sendMessageSchema,
  updateAdminCompanionSchema,
  updateCarePlanSchema,
  updateCompanionSchema,
  updateCompanionStatusSchema,
  updateMemorySchema,
} from '@goferbot/data/schemas'
import { createZodDto } from 'nestjs-zod'

export class CreateCompanionDto extends createZodDto(createCompanionSchema) {}
export class UpdateCompanionDto extends createZodDto(updateCompanionSchema) {}
export class UpdateCompanionStatusDto extends createZodDto(updateCompanionStatusSchema) {}
export class CompanionListQueryDto extends createZodDto(companionListQuerySchema) {}

export class CreateAdminCompanionDto extends createZodDto(createAdminCompanionSchema) {}
export class UpdateAdminCompanionDto extends createZodDto(updateAdminCompanionSchema) {}

export class CreateConversationDto extends createZodDto(createConversationSchema) {}
export class ConversationListQueryDto extends createZodDto(conversationListQuerySchema) {}

export class SendMessageDto extends createZodDto(sendMessageSchema) {}
export class MessageListQueryDto extends createZodDto(companionMessageListQuerySchema) {}

export class CreateMemoryDto extends createZodDto(createMemorySchema) {}
export class MemoryListQueryDto extends createZodDto(memoryListQuerySchema) {}
export class UpdateMemoryDto extends createZodDto(updateMemorySchema) {}

export class CreateFeedbackDto extends createZodDto(createFeedbackSchema) {}

export class UpdateCarePlanDto extends createZodDto(updateCarePlanSchema) {}
export class GenerateCareEventDto extends createZodDto(generateCareEventSchema) {}
