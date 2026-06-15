import { createZodDto } from 'nestjs-zod'
import { chatMessagesRequestSchema, messageListQuerySchema } from '@goferbot/data/schemas'
import type { ChatMessagesRequest, MessageListQuery } from '@goferbot/data'

export class ChatMessagesDto extends createZodDto(chatMessagesRequestSchema) {
  declare response_mode: ChatMessagesRequest['response_mode']
  declare conversation_id?: ChatMessagesRequest['conversation_id']
  declare query: ChatMessagesRequest['query']
  declare inputs?: ChatMessagesRequest['inputs']
  declare files?: ChatMessagesRequest['files']
  declare parent_message_id?: ChatMessagesRequest['parent_message_id']
  declare provider_key?: ChatMessagesRequest['provider_key']
  declare model?: ChatMessagesRequest['model']
  declare knowledge_base_ids?: ChatMessagesRequest['knowledge_base_ids']
}

export class MessageListQueryDto extends createZodDto(messageListQuerySchema) {
  declare conversation_id: MessageListQuery['conversation_id']
  declare page: MessageListQuery['page']
  declare size: MessageListQuery['size']
}
