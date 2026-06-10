import { getKbList as apiGetKbList, uploadFile as apiUploadFile } from '@/api/kb'
import {
  getFolders as apiGetFolders,
  getDocuments as apiGetDocuments,
  deleteDocument as apiDeleteDocument,
  renameDocument as apiRenameDocument,
  moveDocument as apiMoveDocument,
  createFolder as apiCreateFolder,
  renameFolder as apiRenameFolder,
  deleteFolder as apiDeleteFolder,
} from '@/api/file'
import { useKbStore } from './store'
import type { Folder, DocumentItem } from './types'

export async function fetchKbList(): Promise<{ success: boolean; error?: string }> {
  const { setEntries, setKbLoading } = useKbStore.getState()
  setKbLoading(true)
  try {
    const res = await apiGetKbList().send()
    const data = res as { entries?: KbEntry[] }
    if (data?.entries) setEntries(data.entries)
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '加载知识库列表失败' }
  } finally {
    setKbLoading(false)
  }
}

import type { KbEntry } from '@goferbot/data'

let currentLoadId = 0

export async function loadKbItems(kbId: string, folderId: string | null = null) {
  const { setFolders, setDocuments, setCurrentKbId, setCurrentFolderId, setFileLoading, setFileError } =
    useKbStore.getState()

  const thisLoadId = ++currentLoadId

  setCurrentKbId(kbId)
  setCurrentFolderId(folderId)
  setFileLoading(true)
  setFileError(null)

  try {
    const [folders, documents] = await Promise.all([
      apiGetFolders(kbId, folderId).send(),
      apiGetDocuments(kbId, folderId).send(),
    ])
    if (thisLoadId !== currentLoadId) return
    setFolders((folders as Folder[]) ?? [])
    setDocuments((documents as DocumentItem[]) ?? [])
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

export async function uploadFiles(kbId: string, files: File[], folderId?: string | null) {
  const { addUploadTask, startUploadTask, updateUploadProgress, markUploadComplete, markUploadFailed } = useKbStore.getState()

  const taskIds: string[] = []
  for (const file of files) {
    const taskId = addUploadTask({
      fileName: file.name,
      fileSize: file.size,
      kbId,
      folderId,
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
