import { z } from 'zod'

export const retrievalModeSchema = z.enum(['vector', 'bm25', 'hybrid']).optional()

export const ragRetrieveSchema = z.object({
  query: z.string().min(1, 'query 不能为空'),
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
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
})

export const ragQuerySchema = ragRetrieveSchema.extend({
  systemPrompt: z.string().optional(),
})

export const ragIndexSchema = z.object({
  documentId: z.string().min(1, 'documentId 不能为空'),
  kbId: z.string().min(1, 'kbId 不能为空'),
  content: z.string().min(1, 'content 不能为空'),
  chunkSize: z.number().int().min(100).max(8000).optional(),
  overlap: z.number().int().min(0).max(2000).optional(),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
})
