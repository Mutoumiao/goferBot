import { z } from 'zod'

export const settingsSchema = z.object({
  providers: z.object({
    openai: z.object({ apiKey: z.string(), model: z.string(), baseUrl: z.string().url() }),
    claude: z.object({ apiKey: z.string(), model: z.string(), baseUrl: z.string().url() }),
    deepseek: z.object({ apiKey: z.string(), model: z.string(), baseUrl: z.string().url() }),
    custom: z.object({ apiKey: z.string(), model: z.string(), baseUrl: z.string().url() }),
    ollama: z.object({ enabled: z.boolean(), url: z.string().url(), model: z.string() }),
  }).strict(),
  embeddingProvider: z.object({
    provider: z.string(),
    apiKey: z.string(),
    model: z.string(),
    baseUrl: z.string().url(),
  }).strict(),
  temperature: z.number().min(0).max(2),
  defaultChatProvider: z.string(),
}).strict()

export type SettingsRequest = z.infer<typeof settingsSchema>
