import { createZodDto } from 'nestjs-zod'
import { chatMessagesRequestSchema } from '@goferbot/data/schemas'

export class ChatMessagesDto extends createZodDto(chatMessagesRequestSchema) {
  declare response_mode: 'streaming'
  declare conversation_id?: string
  declare query: string
  declare inputs?: Record<string, unknown>
  declare files?: unknown[]
  declare parent_message_id?: string | null
  declare knowledge_base_ids?: string[]
  declare provider_key?: string
}
