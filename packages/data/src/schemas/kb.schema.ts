import { z } from 'zod'

export const kbEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  fileCount: z.number().optional().default(0),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
})

export const createKbRequestSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(100, '名称最长100字符'),
  description: z.string().optional(),
})

export const updateKbRequestSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(100, '名称最长100字符'),
  description: z.string().optional(),
})

export const kbListResponseSchema = z.object({
  entries: z.array(kbEntrySchema),
  total: z.number().optional(),
})
