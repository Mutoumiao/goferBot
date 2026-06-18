import { chatMessagesRequestSchema, messageListQuerySchema } from '@goferbot/data/schemas'
import { createZodDto } from 'nestjs-zod'

export class ChatMessagesDto extends createZodDto(chatMessagesRequestSchema) {}

export class MessageListQueryDto extends createZodDto(messageListQuerySchema) {}
