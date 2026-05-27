// packages/rag-sdk/src/schema.ts
import { z } from 'zod'

export const DocumentSourceSchema = z.object({
  documentId: z.string().uuid(),
  kbId: z.string().uuid(),
  content: z.string().min(1),
  mimeType: z.string().min(1),
})

export const QuerySchema = z.object({
  original: z.string().min(1),
  rewritten: z.string().optional(),
  expanded: z.array(z.string()).optional(),
  kbIds: z.array(z.string().uuid()).min(1),
  filters: z.record(z.string(), z.unknown()).optional(),
})

export const ChunkSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  kbId: z.string().uuid(),
  content: z.string().min(1),
  chunkIndex: z.number().int().min(0),
  tokenCount: z.number().int().optional(),
  parentId: z.string().uuid().optional(),
  hierarchyPath: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const ChunkWithScoreSchema = ChunkSchema.extend({
  score: z.number().min(0).max(1),
})

export const RetrievalCandidateSchema = z.object({
  chunk: ChunkSchema,
  score: z.number().min(0).max(1),
  source: z.enum(['vector', 'keyword', 'hybrid']),
  route: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const EmbeddingConfigSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  dimension: z.number().int().positive(),
  apiKey: z.string(),
  baseUrl: z.string().url().optional(),
})

export const HybridSearchOptionsSchema = z.object({
  vectorWeight: z.number().min(0).max(1).optional(),
  keywordWeight: z.number().min(0).max(1).optional(),
  rrfK: z.number().int().positive().optional(),
})
