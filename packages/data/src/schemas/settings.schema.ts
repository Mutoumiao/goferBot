import { z } from 'zod'

export const providerSchema = z.object({
  name: z.string().min(1, '名称不能为空'),
  apiKey: z.string(),
  model: z.string().min(1, '模型名称不能为空'),
  baseUrl: z.string().optional(),
})

export const embeddingProviderSchema = z.object({
  provider: z.string(),
  apiKey: z.string(),
  model: z.string(),
  baseUrl: z.string().optional(),
})

export const settingsSchema = z.object({
  providers: z.record(z.string(), providerSchema),
  embeddingProvider: embeddingProviderSchema,
  temperature: z.number().min(0).max(2, 'temperature 范围 0-2'),
  defaultChatProvider: z.string().min(1, 'defaultChatProvider 不能为空'),
  appearance: z.enum(['light', 'dark', 'system']),
  fontSizeLevel: z.number().int().min(1).max(5),
})

export const settingsResponseSchema = settingsSchema