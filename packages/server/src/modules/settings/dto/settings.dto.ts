import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { validateBaseUrl, getAllowedHostnames } from '../../../common/utils/ssrf-guard.js'

const providerSchema = z.object({
  apiKey: z.string(),
  model: z.string(),
  baseUrl: z.string().refine(
    (v) => v === '' || (z.string().url().safeParse(v).success && validateBaseUrl(v)),
    { message: `baseUrl 必须是合法 URL 或空字符串，仅允许: ${getAllowedHostnames().join(', ')}` },
  ),
})

const ollamaSchema = z.object({
  enabled: z.boolean(),
  url: z.string().url('ollama url 必须是合法 URL').refine(
    (v) => validateBaseUrl(v, { allowLocalhost: true, requireHttps: false }),
    { message: 'ollama url 不允许指向内网地址（localhost 除外）' },
  ),
  model: z.string(),
})

const embeddingProviderSchema = z.object({
  provider: z.string(),
  apiKey: z.string(),
  model: z.string(),
  baseUrl: z.string().refine(
    (v) => v === '' || (z.string().url().safeParse(v).success && validateBaseUrl(v)),
    { message: `baseUrl 必须是合法 URL 或空字符串，仅允许: ${getAllowedHostnames().join(', ')}` },
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
