import { z } from 'zod'
import { createPagedResponseSchema } from './common.schema.js'
import { folderSchema } from './folder.schema.js'
import { documentSchema } from './document.schema.js'

export const kbEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  icon: z.string().max(10).optional(),
  fileCount: z.number().optional(),
  isPinned: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
})

export const createKbRequestSchema = z.object({
  name: z.string().min(1, '知识库名称不能为空').max(100, '名称过长'),
  description: z.string().max(500, '描述过长').optional(),
  icon: z.string().max(10, '图标过长').optional(),
})

export const updateKbRequestSchema = z.object({
  name: z.string().min(1, '知识库名称不能为空').max(100, '名称过长').optional(),
  description: z.string().max(500, '描述过长').nullable().optional(),
  isPinned: z.boolean().optional(),
  sortOrder: z.number().int().min(0, '排序值不能为负数').optional(),
  icon: z.string().max(10, '图标过长').nullable().optional(),
})

export const kbListResponseSchema = createPagedResponseSchema(kbEntrySchema)

export const kbDetailResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  icon: z.string().max(10).optional(),
  folders: z.array(folderSchema),
  documents: z.array(documentSchema),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
})

export const documentStatusSchema = z.enum([
  'uploaded',
  'chunking',
  'embedding',
  'indexing',
  'ready',
  'failed',
])

export const documentStatusResponseSchema = z.object({
  id: z.string(),
  status: documentStatusSchema,
  indexedAt: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
})
