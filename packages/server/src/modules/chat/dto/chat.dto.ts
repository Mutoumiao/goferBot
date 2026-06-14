import { createZodDto } from 'nestjs-zod'
import { chatMessagesRequestSchema, messageListQuerySchema } from '@goferbot/data/schemas'

export class ChatMessagesDto extends createZodDto(chatMessagesRequestSchema) {}

export class MessageListQueryDto extends createZodDto(messageListQuerySchema) {}
