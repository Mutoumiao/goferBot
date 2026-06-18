import { z } from 'zod'

export const createSessionRequestSchema = z.object({
  title: z.string().max(100, '标题过长').optional(),
  provider: z.string().max(50, '提供商名称过长').optional(),
  model: z.string().max(50, '模型名称过长').optional(),
})

export const updateSessionRequestSchema = z.object({
  title: z
    .string()
    .min(1, '标题不能为空')
    .max(100, '标题过长')
    .refine((v) => v.trim().length > 0, { message: '标题不能为空' }),
})

export const sessionSchema = z.object({
  id: z.string(),
  userId: z.string().optional(),
  title: z.string(),
  provider: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  messageCount: z.number(),
})
