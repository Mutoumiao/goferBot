import { z } from 'zod'

export const kbEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  fileCount: z.number().optional().default(0),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
})

export const createKbRequestSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200),
  description: z.string().optional(),
})

export const kbListResponseSchema = z.object({
  entries: z.array(kbEntrySchema),
  total: z.number().optional(),
})
