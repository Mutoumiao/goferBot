import { createZodDto } from 'nestjs-zod'
import { streamChatRequestSchema } from '@goferbot/data'

export class ChatDto extends createZodDto(streamChatRequestSchema) {}
