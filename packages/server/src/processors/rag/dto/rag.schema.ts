import { z } from 'zod'

/**
 * Reserved / ES-unsafe metadata key prefixes. Any key starting with one of
 * these is rejected at the DTO layer to prevent NoSQL injection through the
 * `metadata` filter channel (e.g. `__proto__`, `.script`, `$`, or other keys
 * that ES would interpret as a DSL operator).
 */
const METADATA_BLOCKED_PREFIXES = ['__', '$', '.']

/**
 * Allowed metadata field allowlist. Keep this conservative: only whitelisted
 * business fields may be used as structured filters. Everything else must be
 * explicitly added to this list before it becomes queryable.
 */
export const METADATA_ALLOWED_KEYS = [
  'year',
  'status',
  'type',
  'category',
  'source',
  'language',
  'author',
  'priority',
  'department',
  'project',
  'tags',
  'version',
] as const

const METADATA_KEY_PATTERN = /^[a-z][a-z0-9_]{0,63}$/i

const metadataKeySchema = z.string().superRefine((key, ctx) => {
  if (!METADATA_KEY_PATTERN.test(key)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `metadata key "${key}" must match ${METADATA_KEY_PATTERN}`,
    })
    return
  }
  if (METADATA_BLOCKED_PREFIXES.some((p) => key.startsWith(p))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `metadata key "${key}" uses a reserved prefix`,
    })
    return
  }
  const allowlist = new Set<string>(METADATA_ALLOWED_KEYS)
  if (!allowlist.has(key)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `metadata key "${key}" is not in the allowlist`,
    })
  }
})

const metadataScalarSchema = z.union([
  z.string().max(500),
  z.number().finite(),
  z.boolean(),
])

const metadataValueSchema = z.union([
  metadataScalarSchema,
  z.array(metadataScalarSchema).max(20),
])

export const metadataFilterSchema = z.record(metadataKeySchema, metadataValueSchema)

export const retrievalModeSchema = z.enum(['vector', 'bm25', 'hybrid']).optional()

export const ragRetrieveSchema = z.object({
  query: z.string().min(1, 'query 不能为空').max(2000, 'query 长度不能超过 2000'),
  kbIds: z.array(z.string().uuid()).optional(),
  documentIds: z.array(z.string().uuid()).optional(),
  topK: z.number().int().min(1).max(50).optional(),
  candidateK: z.number().int().min(5).max(500).optional(),
  minScore: z.number().min(0).max(1).optional(),
  mode: retrievalModeSchema,
  vectorWeight: z.number().min(0).max(1).optional(),
  bm25Weight: z.number().min(0).max(1).optional(),
  rrfK: z.number().int().min(1).max(1000).optional(),
  needRerank: z.boolean().optional(),
  rerankTopK: z.number().int().min(1).max(50).optional(),
  metadata: metadataFilterSchema.optional(),
})

export const ragQuerySchema = ragRetrieveSchema.extend({
  systemPrompt: z.string().optional(),
})

export const ragIndexSchema = z.object({
  documentId: z.string().min(1, 'documentId 不能为空').max(256),
  kbId: z.string().min(1, 'kbId 不能为空').max(256),
  content: z.string().min(1, 'content 不能为空').max(200_000, 'content 过长'),
  chunkSize: z.number().int().min(100).max(8000).optional(),
  overlap: z.number().int().min(0).max(2000).optional(),
  metadata: metadataFilterSchema.optional(),
})
