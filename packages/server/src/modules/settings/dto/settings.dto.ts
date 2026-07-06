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
  baseUrl: baseUrlSchema,
  isCompleteUrl: z.boolean().default(false),
  timeoutMs: z.number().min(1000, 'timeout 至少 1000ms').default(300_000),
  models: z.array(modelSchema).default([]),
})
export type ModelProvider = z.infer<typeof modelProviderSchema>

/**
 * ResolvedProvider — provider + model 扁平化视图
 *
 * resolveProvider() 返回此类型：provider 级字段 + 被选中的 model 级字段。
 * 消费端（RAG/Chat/Companion）可直接使用 .model / .dimensions 等，无需感知 models 数组。
 */
export interface ResolvedProvider {
  id: string
  name: string
  notes?: string
  enabled: boolean
  apiKey: string
  baseUrl: string
  isCompleteUrl: boolean
  timeoutMs: number
  model: string
  type: ProviderType
  dimensions?: number
  maxLength?: number
}

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

export class SettingsDto extends createZodDto(settingsSchema) {}

/**
 * 输入用 schema：新建 Provider 时 id 可为空，由 SystemConfigService.saveProvider 自动生成。
 * 存储用 modelProviderSchema 保持 id 非空约束（settingsSchema.parse 校验）。
 */
const saveProviderSchema = modelProviderSchema.extend({
  id: z.string().default(''),
})

export class ProviderDto extends createZodDto(saveProviderSchema) {}

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
