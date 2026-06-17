import { z } from 'zod'

export const createFolderRequestSchema = z.object({
  name: z.string().min(1, '文件夹名称不能为空').max(100, '名称过长'),
  parentId: z.string().uuid('parentId 格式非法').nullable().optional(),
})

export const updateFolderRequestSchema = z.object({
  name: z.string().min(1, '文件夹名称不能为空').max(100, '名称过长'),
})

export const moveFolderRequestSchema = z.object({
  targetKbId: z.string().uuid('targetKbId 格式非法').optional(),
  targetFolderId: z.string().uuid('targetFolderId 格式非法').nullable().optional(),
}).refine(
  ({ targetKbId, targetFolderId }) => targetKbId !== undefined || targetFolderId !== undefined,
  { message: 'targetKbId 与 targetFolderId 至少提供一个', path: ['targetKbId'] },
)

export const copyFolderRequestSchema = moveFolderRequestSchema

export const folderSchema = z.object({
  id: z.string(),
  name: z.string(),
  kbId: z.string(),
  parentId: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
})