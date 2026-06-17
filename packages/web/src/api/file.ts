import { alovaInstance } from '@/utils/server'

// ---- 文件夹 ----

export interface SortParams {
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

/** 获取文件夹列表 */
export const getFolders = (kbId: string, parentId?: string | null, sort?: SortParams) =>
  alovaInstance.Get(`/knowledge-bases/${kbId}/folders`, {
    params: {
      parentId: parentId ?? '',
      ...(sort?.sortBy && { sortBy: sort.sortBy }),
      ...(sort?.sortOrder && { sortOrder: sort.sortOrder }),
    },
  })

/** 创建文件夹 */
export const createFolder = (kbId: string, name: string, parentId?: string | null) =>
  alovaInstance.Post(`/knowledge-bases/${kbId}/folders`, { name, parentId })

/** 重命名文件夹 */
export const renameFolder = (kbId: string, folderId: string, name: string) =>
  alovaInstance.Patch(`/knowledge-bases/${kbId}/folders/${folderId}`, { name })

/** 删除文件夹 */
export const deleteFolder = (kbId: string, folderId: string) =>
  alovaInstance.Delete(`/knowledge-bases/${kbId}/folders/${folderId}`)

/** 获取文件夹面包屑 */
export const getBreadcrumbs = (kbId: string, folderId?: string | null) =>
  alovaInstance.Get(`/knowledge-bases/${kbId}/breadcrumbs`, {
    params: { folderId: folderId ?? '' },
  })

/** 预览文档 */
export const previewDocument = (kbId: string, docId: string) =>
  alovaInstance.Get(`/knowledge-bases/${kbId}/documents/${docId}/preview`)

/** 获取文档列表 */
export const getDocuments = (kbId: string, folderId?: string | null, sort?: SortParams) =>
  alovaInstance.Get(`/knowledge-bases/${kbId}/documents`, {
    params: {
      folderId: folderId ?? '',
      ...(sort?.sortBy && { sortBy: sort.sortBy }),
      ...(sort?.sortOrder && { sortOrder: sort.sortOrder }),
    },
  })

/** 删除文档 */
export const deleteDocument = (kbId: string, docId: string) =>
  alovaInstance.Delete(`/knowledge-bases/${kbId}/documents/${docId}`)

/** 重命名文档 */
export const renameDocument = (kbId: string, docId: string, name: string) =>
  alovaInstance.Patch(`/knowledge-bases/${kbId}/documents/${docId}`, { name })

/** 移动文档到指定文件夹或知识库 */
export const moveDocument = (kbId: string, docId: string, targetKbId?: string, targetFolderId?: string | null) =>
  alovaInstance.Post(`/knowledge-bases/${kbId}/documents/${docId}/move`, {
    targetKbId,
    targetFolderId,
  })

/** 移动文件夹到指定文件夹或知识库 */
export const moveFolder = (kbId: string, folderId: string, targetKbId?: string, targetFolderId?: string | null) =>
  alovaInstance.Post(`/knowledge-bases/${kbId}/folders/${folderId}/move`, {
    targetKbId,
    targetFolderId,
  })

/** 复制文档到指定文件夹或知识库 */
export const copyDocument = (kbId: string, docId: string, targetKbId?: string, targetFolderId?: string | null) =>
  alovaInstance.Post(`/knowledge-bases/${kbId}/documents/${docId}/copy`, {
    targetKbId,
    targetFolderId,
  })

/** 复制文件夹到指定文件夹或知识库 */
export const copyFolder = (kbId: string, folderId: string, targetKbId?: string, targetFolderId?: string | null) =>
  alovaInstance.Post(`/knowledge-bases/${kbId}/folders/${folderId}/copy`, {
    targetKbId,
    targetFolderId,
  })
