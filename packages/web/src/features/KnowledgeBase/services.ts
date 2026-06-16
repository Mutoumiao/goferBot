import { getKbList as apiGetKbList, updateKb as apiUpdateKb, uploadFile as apiUploadFile, searchKbItems as apiSearchKbItems } from '@/api/KnowledgeBase'
import {
  getFolders as apiGetFolders,
  getDocuments as apiGetDocuments,
  getBreadcrumbs as apiGetBreadcrumbs,
  previewDocument as apiPreviewDocument,
  deleteDocument as apiDeleteDocument,
  renameDocument as apiRenameDocument,
  moveDocument as apiMoveDocument,
  createFolder as apiCreateFolder,
  renameFolder as apiRenameFolder,
  deleteFolder as apiDeleteFolder,
} from '@/api/file'
import { useKbStore } from './store'
import type { Folder, DocumentItem, ItemSortParams } from './types'
import type { KbListResponse } from '@goferbot/data'
import { toast } from 'sonner'

export async function fetchKbList(): Promise<{ success: boolean; error?: string }> {
  const { setEntries, setKbLoading } = useKbStore.getState()
  setKbLoading(true)
  try {
    const res = await apiGetKbList().send()
    const data = res as KbListResponse
    setEntries(data.items ?? [])
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '加载知识库列表失败' }
  } finally {
    setKbLoading(false)
  }
}

const pinningIds = new Set<string>()

export async function pinKnowledgeBase(id: string, isPinned: boolean): Promise<boolean> {
  if (pinningIds.has(id)) return false
  pinningIds.add(id)
  const { updateEntry } = useKbStore.getState()
  try {
    await apiUpdateKb(id, { isPinned }).send()
    updateEntry(id, { isPinned })
    await fetchKbList()
    return true
  } catch (e) {
    toast.error('置顶操作失败，请稍后重试')
    return false
  } finally {
    pinningIds.delete(id)
  }
}

export function removeKnowledgeBaseAndClearSelection(kbId: string) {
  const {
    selectedId,
    setSelectedId,
    setCurrentKbId,
    setCurrentFolderId,
    setFolders,
    setDocuments,
    setBreadcrumbs,
    removeEntry,
  } = useKbStore.getState()

  removeEntry(kbId)
  if (selectedId !== kbId) return

  setSelectedId(null)
  setCurrentKbId(null)
  setCurrentFolderId(null)
  setFolders([])
  setDocuments([])
  setBreadcrumbs([])
}

let currentLoadId = 0

export async function loadKbItems(
  kbId: string,
  folderId: string | null = null,
  sort?: ItemSortParams,
) {
  const {
    setFolders,
    setDocuments,
    setCurrentKbId,
    setCurrentFolderId,
    setFileLoading,
    setFileError,
    setBreadcrumbs,
  } = useKbStore.getState()

  const thisLoadId = ++currentLoadId

  setCurrentKbId(kbId)
  setCurrentFolderId(folderId)
  setFileLoading(true)
  setFileError(null)

  const folderSort = sort
    ? { sortBy: sort.sortBy === 'type' ? 'name' : sort.sortBy, sortOrder: sort.sortOrder }
    : undefined
  const documentSort = sort ? { sortBy: sort.sortBy, sortOrder: sort.sortOrder } : undefined

  try {
    const [folders, documents, breadcrumbs] = await Promise.all([
      apiGetFolders(kbId, folderId, folderSort).send(),
      apiGetDocuments(kbId, folderId, documentSort).send(),
      apiGetBreadcrumbs(kbId, folderId).send(),
    ])
    if (thisLoadId !== currentLoadId) return
    setFolders((folders as Folder[]) ?? [])
    setDocuments((documents as DocumentItem[]) ?? [])
    setBreadcrumbs((breadcrumbs as Folder[]) ?? [])
  } catch (e) {
    if (thisLoadId !== currentLoadId) return
    setFileError(e instanceof Error ? e.message : '加载失败')
  } finally {
    if (thisLoadId === currentLoadId) {
      setFileLoading(false)
    }
  }
}

export async function removeDocument(docId: string) {
  const { currentKbId, documents, setDocuments, setFileLoading, setFileError } = useKbStore.getState()
  if (!currentKbId) return

  setFileLoading(true)
  setFileError(null)
  try {
    await apiDeleteDocument(currentKbId, docId).send()
    setDocuments(documents.filter((d) => d.id !== docId))
  } catch (e) {
    setFileError(e instanceof Error ? e.message : '删除失败')
  } finally {
    setFileLoading(false)
  }
}

export async function renameDocument(docId: string, name: string) {
  const { currentKbId, documents, setDocuments, setFileLoading, setFileError } = useKbStore.getState()
  if (!currentKbId) return

  setFileLoading(true)
  setFileError(null)
  try {
    const updated = await apiRenameDocument(currentKbId, docId, name).send()
    setDocuments(documents.map((d) => (d.id === docId ? (updated as DocumentItem) : d)))
  } catch (e) {
    setFileError(e instanceof Error ? e.message : '重命名失败')
  } finally {
    setFileLoading(false)
  }
}

export async function moveDocument(docId: string, targetFolderId: string | null) {
  const { currentKbId, documents, setDocuments, setFileLoading, setFileError } = useKbStore.getState()
  if (!currentKbId) return

  setFileLoading(true)
  setFileError(null)
  try {
    await apiMoveDocument(currentKbId, docId, targetFolderId).send()
    setDocuments(documents.filter((d) => d.id !== docId))
  } catch (e) {
    setFileError(e instanceof Error ? e.message : '移动失败')
  } finally {
    setFileLoading(false)
  }
}

export async function previewDocument(docId: string) {
  const { currentKbId, setFileLoading, setFileError } = useKbStore.getState()
  if (!currentKbId) return null

  setFileLoading(true)
  setFileError(null)
  try {
    const result = await apiPreviewDocument(currentKbId, docId).send()
    return result as { type: 'text' | 'pdf' | 'unsupported'; mimeType: string; content?: string; url?: string | null }
  } catch (e) {
    setFileError(e instanceof Error ? e.message : '预览失败')
    return null
  } finally {
    setFileLoading(false)
  }
}

export async function searchKbItems(query: string) {
  const { currentKbId, setFolders, setDocuments, setFileLoading, setFileError } = useKbStore.getState()
  if (!currentKbId) return { folders: [], documents: [] }

  const trimmed = query.trim()
  if (!trimmed) {
    return { folders: [], documents: [] }
  }

  setFileLoading(true)
  setFileError(null)
  try {
    const result = await apiSearchKbItems(currentKbId, trimmed).send()
    const data = result as { folders: Folder[]; documents: DocumentItem[] }
    setFolders(data.folders ?? [])
    setDocuments(data.documents ?? [])
    return data
  } catch (e) {
    setFileError(e instanceof Error ? e.message : '搜索失败')
    return { folders: [], documents: [] }
  } finally {
    setFileLoading(false)
  }
}

export async function createFolder(kbId: string, name: string, parentId: string | null = null) {
  const updated = await apiCreateFolder(kbId, name, parentId).send()
  return updated as Folder
}

export async function renameFolder(kbId: string, folderId: string, name: string) {
  const updated = await apiRenameFolder(kbId, folderId, name).send()
  return updated as Folder
}

export async function removeFolder(kbId: string, folderId: string) {
  await apiDeleteFolder(kbId, folderId).send()
}

export async function removeItem(item: Folder | DocumentItem) {
  const { currentKbId, folders, documents, setFolders, setDocuments, setFileLoading, setFileError } = useKbStore.getState()
  if (!currentKbId) return

  const isFolderItem = !('status' in item)
  setFileLoading(true)
  setFileError(null)
  try {
    if (isFolderItem) {
      await apiDeleteFolder(currentKbId, item.id).send()
      setFolders(folders.filter((f) => f.id !== item.id))
    } else {
      await apiDeleteDocument(currentKbId, item.id).send()
      setDocuments(documents.filter((d) => d.id !== item.id))
    }
  } catch (e) {
    setFileError(e instanceof Error ? e.message : '删除失败')
  } finally {
    setFileLoading(false)
  }
}

export async function renameItem(item: Folder | DocumentItem, name: string) {
  const { currentKbId, folders, documents, setFolders, setDocuments, setFileLoading, setFileError } = useKbStore.getState()
  if (!currentKbId) return

  const isFolderItem = !('status' in item)
  setFileLoading(true)
  setFileError(null)
  try {
    if (isFolderItem) {
      const updated = await apiRenameFolder(currentKbId, item.id, name).send()
      setFolders(folders.map((f) => (f.id === item.id ? (updated as Folder) : f)))
    } else {
      const updated = await apiRenameDocument(currentKbId, item.id, name).send()
      setDocuments(documents.map((d) => (d.id === item.id ? (updated as DocumentItem) : d)))
    }
  } catch (e) {
    setFileError(e instanceof Error ? e.message : '重命名失败')
  } finally {
    setFileLoading(false)
  }
}

export async function addFolder(kbId: string, name: string, parentId?: string | null) {
  const { folders, setFolders, setFileLoading, setFileError } = useKbStore.getState()
  setFileLoading(true)
  setFileError(null)
  try {
    const created = await apiCreateFolder(kbId, name, parentId).send()
    setFolders([...folders, created as Folder])
    return created as Folder
  } catch (e) {
    setFileError(e instanceof Error ? e.message : '创建文件夹失败')
    throw e
  } finally {
    setFileLoading(false)
  }
}

export async function uploadFiles(kbId: string, files: File[], folderId?: string | null) {
  const { addUploadTask, startUploadTask, updateUploadProgress, markUploadComplete, markUploadFailed } = useKbStore.getState()

  const taskIds: string[] = []
  for (const file of files) {
    const taskId = addUploadTask({
      fileName: file.name,
      fileSize: file.size,
      kbId,
      folderId,
      file,
    })
    taskIds.push(taskId)

    const formData = new FormData()
    formData.append('file', file)
    if (folderId) formData.append('folderId', folderId)

    startUploadTask(taskId)

    try {
      // 模拟上传进度（实际应由 API 进度回调驱动）
      updateUploadProgress(taskId, 50)
      await apiUploadFile(kbId, formData).send()
      markUploadComplete(taskId)
    } catch (e) {
      markUploadFailed(taskId, e instanceof Error ? e.message : '上传失败')
    }
  }

  return taskIds
}

export function navigateToFolder(folderId: string | null) {
  const { currentKbId, setCurrentFolderId } = useKbStore.getState()
  if (!currentKbId) return
  setCurrentFolderId(folderId)
}
