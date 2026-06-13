import { z } from 'zod'

export const createDocumentRequestSchema = z.object({
  name: z.string().min(1, '文件名不能为空').max(255, '文件名过长'),
  folderId: z.string().uuid('folderId 格式非法').nullable().optional(),
})

export const updateDocumentRequestSchema = z.object({
  name: z.string().min(1, '文件名不能为空').max(255, '文件名过长').optional(),
  folderId: z.string().uuid('folderId 格式非法').nullable().optional(),
})

export const documentSchema = z.object({
  id: z.string(),
  name: z.string(),
  kbId: z.string(),
  folderId: z.string().nullable().optional(),
  size: z.number().optional(),
  status: z.enum(['uploading', 'processing', 'completed', 'failed']),
  progress: z.number().min(0).max(100).optional(),
  error: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
})