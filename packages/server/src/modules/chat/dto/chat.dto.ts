import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

const ALLOWED_BASE_URLS = [
  'https://api.openai.com',
  'https://api.deepseek.com',
  'https://api.anthropic.com',
]

export const chatSchema = z.object({
  message: z
    .string()
    .min(1, '消息不能为空')
    .max(4000, '消息过长，最多 4000 字符'),
  sessionId: z.string().uuid('sessionId 格式不正确'),
  knowledgeBaseIds: z.array(z.string().uuid()).optional(),
  config: z.object({
    provider: z.string().min(1, 'provider 不能为空'),
    model: z.string().min(1, 'model 不能为空'),
    baseUrl: z
      .string()
      .url('baseUrl 必须是合法 URL')
      .refine(
        (url) => ALLOWED_BASE_URLS.some((allowed) => url.startsWith(allowed)),
        {
          message: `baseUrl 不在白名单中，仅允许: ${ALLOWED_BASE_URLS.join(', ')}`,
        },
      ),
    apiKey: z.string().min(1, 'apiKey 不能为空'),
  }),
})

export class ChatDto extends createZodDto(chatSchema) {}
