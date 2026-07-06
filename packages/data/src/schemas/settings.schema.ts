import { z } from 'zod'

export const providerTypeSchema = z.enum(['llm', 'embedding', 'reranker', 'document-parser'])
export type ProviderType = z.infer<typeof providerTypeSchema>

export const modelSchema = z.object({
  name: z.string().min(1, '模型名称不能为空'),
  type: providerTypeSchema,
  enabled: z.boolean().default(true),
  dimensions: z.number().int().min(1).optional(),
  maxLength: z.number().int().min(1).optional(),
})
export type Model = z.infer<typeof modelSchema>

export const modelProviderSchema = z.object({
  id: z.string().min(1, 'provider id 不能为空'),
  name: z.string().min(1, '名称不能为空'),
  notes: z.string().optional(),
  enabled: z.boolean().default(true),
  apiKey: z.string(),
  baseUrl: z.string().default(''),
  isCompleteUrl: z.boolean().default(false),
  timeoutMs: z.number().min(1000, 'timeout 至少 1000ms').default(300_000),
  models: z.array(modelSchema).default([]),
})
export type ModelProvider = z.infer<typeof modelProviderSchema>

export const chatConfigSchema = z.object({
  defaultProvider: z.string().min(1, 'defaultProvider 不能为空').optional(),
  enabledProviders: z.array(z.string()).default([]),
  temperature: z.number().min(0).max(2, 'temperature 范围 0-2').default(0.7),
})
export type ChatSettings = z.infer<typeof chatConfigSchema>

export const ragConfigSchema = z.object({
  llmProvider: z.string().min(1, 'llmProvider 不能为空').optional(),
  embeddingProvider: z.string().min(1, 'embeddingProvider 不能为空').optional(),
  rerankerProvider: z.string().optional(),
  timeoutMs: z.number().min(1000, 'timeout 至少 1000ms').default(60_000),
  rerankerAllowedModelPrefixes: z
    .array(z.string())
    .default(['BAAI/', 'Xorbits/', 'sentence-transformers/']),
})
export type RagSettings = z.infer<typeof ragConfigSchema>

export const companionConfigSchema = z.object({
  provider: z.string().min(1, 'provider 不能为空').optional(),
})
export type CompanionSettings = z.infer<typeof companionConfigSchema>

export const indexingConfigSchema = z.object({
  contextualEmbedding: z.boolean().default(false),
  contextualWindow: z.number().int().min(0).default(1),
  parentChunkSize: z.number().int().min(1).default(800),
  childChunkSize: z.number().int().min(1).default(150),
  synonymDict: z
    .record(z.enum(['zh', 'en']), z.record(z.string(), z.array(z.string())))
    .default({ zh: {}, en: {} }),
})
export type IndexingSettings = z.infer<typeof indexingConfigSchema>

export const appearanceConfigSchema = z.object({
  mode: z.enum(['light', 'dark', 'system']).default('light'),
  fontSizeLevel: z.number().int().min(1).max(5).default(3),
})
export type AppearanceSettings = z.infer<typeof appearanceConfigSchema>

export const settingsSchema = z.object({
  version: z.number().default(2),
  providers: z.record(z.string(), modelProviderSchema).default({}),
  chat: chatConfigSchema.default({ enabledProviders: [], temperature: 0.7 }),
  rag: ragConfigSchema.default({
    timeoutMs: 60_000,
    rerankerAllowedModelPrefixes: ['BAAI/', 'Xorbits/', 'sentence-transformers/'],
  }),
  companion: companionConfigSchema.default({}),
  indexing: indexingConfigSchema.default({
    contextualEmbedding: false,
    contextualWindow: 1,
    parentChunkSize: 800,
    childChunkSize: 150,
    synonymDict: { zh: {}, en: {} },
  }),
  appearance: appearanceConfigSchema.default({ mode: 'light', fontSizeLevel: 3 }),
})
export type Settings = z.infer<typeof settingsSchema>

export const settingsResponseSchema = settingsSchema
export type SettingsResponse = z.infer<typeof settingsResponseSchema>

export const settingCategorySchema = z.enum([
  'providers',
  'chat',
  'rag',
  'companion',
  'indexing',
  'appearance',
])
export type SettingCategory = z.infer<typeof settingCategorySchema>

export const availableProvidersResponseSchema = z.object({
  builtIn: z.array(modelProviderSchema),
  custom: z.array(modelProviderSchema),
})
export type AvailableProvidersResponse = z.infer<typeof availableProvidersResponseSchema>

export type CategorySettingsMap = {
  providers: Record<string, ModelProvider>
  chat: ChatSettings
  rag: RagSettings
  companion: CompanionSettings
  indexing: IndexingSettings
  appearance: AppearanceSettings
}

// 兼容旧命名导出（逐步迁移后可删除）
export const providerSchema = modelProviderSchema
export const embeddingProviderSchema = modelProviderSchema
