import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { getAllowedHostnames, validateBaseUrl } from '../../../common/utils/ssrf-guard.js'

export const providerTypeSchema = z.enum(['llm', 'embedding', 'reranker', 'document-parser'])
export type ProviderType = z.infer<typeof providerTypeSchema>

export const baseUrlSchema = z
  .string()
  .refine((v) => v === '' || (z.string().url().safeParse(v).success && validateBaseUrl(v)), {
    message: `baseUrl 必须是合法 URL 或空字符串，仅允许: ${getAllowedHostnames().join(', ')}`,
  })

export const modelProviderSchema = z.object({
  id: z.string().min(1, 'provider id 不能为空'),
  name: z.string().min(1, '名称不能为空'),
  type: providerTypeSchema,
  enabled: z.boolean().default(true),
  model: z.string().min(1, '模型名称不能为空'),
  apiKey: z.string(),
  baseUrl: baseUrlSchema,
  timeoutMs: z.number().min(1000, 'timeout 至少 1000ms').default(300_000),
  dimensions: z.number().int().min(1).optional(),
  maxLength: z.number().int().min(1).optional(),
})

export type ModelProvider = z.infer<typeof modelProviderSchema>

const chatConfigSchema = z.object({
  defaultProvider: z.string().min(1, 'defaultProvider 不能为空').optional(),
  enabledProviders: z.array(z.string()).default([]),
  temperature: z.number().min(0).max(2, 'temperature 范围 0-2').default(0.7),
})

const ragConfigSchema = z.object({
  llmProvider: z.string().min(1, 'llmProvider 不能为空').optional(),
  embeddingProvider: z.string().min(1, 'embeddingProvider 不能为空').optional(),
  rerankerProvider: z.string().optional(),
  timeoutMs: z.number().min(1000, 'timeout 至少 1000ms').default(60_000),
  rerankerAllowedModelPrefixes: z
    .array(z.string())
    .default(['BAAI/', 'Xorbits/', 'sentence-transformers/']),
})

const companionConfigSchema = z.object({
  provider: z.string().min(1, 'provider 不能为空').optional(),
})

const indexingConfigSchema = z.object({
  contextualEmbedding: z.boolean().default(false),
  contextualWindow: z.number().int().min(0).default(1),
  parentChunkSize: z.number().int().min(1).default(800),
  childChunkSize: z.number().int().min(1).default(150),
  synonymDict: z
    .record(z.enum(['zh', 'en']), z.record(z.string(), z.array(z.string())))
    .default({ zh: {}, en: {} }),
})

const appearanceConfigSchema = z.object({
  mode: z.enum(['light', 'dark', 'system']).default('light'),
  fontSizeLevel: z.number().int().min(1).max(5).default(3),
})

export const settingsSchema = z.object({
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

export class SettingsDto extends createZodDto(settingsSchema) {}

export class ProviderDto extends createZodDto(modelProviderSchema) {}

export class ChatSettingsDto extends createZodDto(chatConfigSchema) {}
export class RagSettingsDto extends createZodDto(ragConfigSchema) {}
export class CompanionSettingsDto extends createZodDto(companionConfigSchema) {}
export class IndexingSettingsDto extends createZodDto(indexingConfigSchema) {}
export class AppearanceSettingsDto extends createZodDto(appearanceConfigSchema) {}

export type CategoryDto =
  | ChatSettingsDto
  | RagSettingsDto
  | CompanionSettingsDto
  | IndexingSettingsDto
  | AppearanceSettingsDto

export const categorySchemaMap = {
  chat: chatConfigSchema,
  rag: ragConfigSchema,
  companion: companionConfigSchema,
  indexing: indexingConfigSchema,
  appearance: appearanceConfigSchema,
} satisfies Record<string, z.ZodTypeAny>
