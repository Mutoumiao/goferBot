import { z } from 'zod'

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

export const kbListResponseSchema = z.object({
  entries: z.array(kbEntrySchema),
  total: z.number().optional(),
})