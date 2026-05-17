import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

const providerSchema = z.object({
  apiKey: z.string().min(1, 'apiKey 不能为空'),
  model: z.string().min(1, 'model 不能为空'),
  baseUrl: z.string().refine(
    (v) => v === '' || z.string().url().safeParse(v).success,
    { message: 'baseUrl 必须是合法 URL 或空字符串' },
  ),
})

const ollamaSchema = z.object({
  enabled: z.boolean(),
  url: z.string().url('ollama url 必须是合法 URL'),
  model: z.string(),
})

const embeddingProviderSchema = z.object({
  provider: z.string().min(1, 'provider 不能为空'),
  apiKey: z.string().min(1, 'apiKey 不能为空'),
  model: z.string().min(1, 'model 不能为空'),
  baseUrl: z.string().refine(
    (v) => v === '' || z.string().url().safeParse(v).success,
    { message: 'baseUrl 必须是合法 URL 或空字符串' },
  ),
})

export const settingsSchema = z.object({
  providers: z.object({
    openai: providerSchema,
    claude: providerSchema,
    deepseek: providerSchema,
    custom: providerSchema,
    ollama: ollamaSchema,
  }),
  embeddingProvider: embeddingProviderSchema,
  temperature: z.number().min(0).max(2, 'temperature 范围 0-2'),
  defaultChatProvider: z.string().min(1, 'defaultChatProvider 不能为空'),
}).refine(
  (data) => Object.keys(data.providers).includes(data.defaultChatProvider),
  {
    message: 'defaultChatProvider 必须是 providers 中的 key 之一',
    path: ['defaultChatProvider'],
  },
)

export class SettingsDto extends createZodDto(settingsSchema) {}
