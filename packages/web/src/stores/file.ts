import { create } from 'zustand'
import {
  getFolders,
  getDocuments,
  deleteDocument as apiDeleteDocument,
  renameDocument as apiRenameDocument,
  moveDocument as apiMoveDocument,
  createFolder as apiCreateFolder,
  renameFolder as apiRenameFolder,
  deleteFolder as apiDeleteFolder,
} from '@/api/file'

// ---- 类型定义 ----
export interface Folder {
  id: string
  kbId: string
  parentId: string | null
  name: string
  createdAt: string
  updatedAt: string
}

export interface DocumentItem {
  id: string
  kbId: string
  folderId: string | null
  name: string
  ext: string | null
  mimeType: string | null
  size: number | null
  status: 'uploaded' | 'parsing' | 'chunking' | 'indexing' | 'ready' | 'failed'
  createdAt: string
  updatedAt: string
}

export interface UploadTask {
  id: string
  fileName: string
  fileSize: number
  progress: number
  status: 'queued' | 'uploading' | 'completed' | 'failed'
  error?: string
  kbId: string
  folderId?: string | null
}

interface FileState {
  uploadTasks: UploadTask[]
  maxConcurrent: number
  folders: Folder[]
  documents: DocumentItem[]
  currentKbId: string | null
  currentFolderId: string | null
  isLoading: boolean
  error: string | null

  // 派生
  breadcrumb: () => Folder[]
  activeUploadCount: () => number

  // 上传队列 Actions
  addTask: (task: Omit<UploadTask, 'id' | 'progress' | 'status'>) => string
  updateProgress: (taskId: string, progress: number) => void
  markComplete: (taskId: string) => void
  markFailed: (taskId: string, error: string) => void
  removeTask: (taskId: string) => void
  clearCompleted: () => void
  processQueue: () => void

  // 文件浏览 Actions
  loadItems: (kbId: string, folderId?: string | null) => Promise<void>
  deleteDocument: (docId: string) => Promise<void>
  renameDocument: (docId: string, name: string) => Promise<void>
  moveDocument: (docId: string, targetFolderId: string | null) => Promise<void>
  createFolder: (kbId: string, name: string, parentId?: string | null) => Promise<Folder>
  renameFolder: (kbId: string, folderId: string, name: string) => Promise<Folder>
  deleteFolder: (kbId: string, folderId: string) => Promise<void>
  clearError: () => void
  resetFileBrowse: () => void
}

export const useFileStore = create<FileState>((set, get) => {
  const processQueue = () => {
    const { uploadTasks, maxConcurrent } = get()
    const activeCount = uploadTasks.filter((t) => t.status === 'uploading').length
    if (maxConcurrent <= 0) return

    const available = maxConcurrent - activeCount
    if (available <= 0) return

    let started = 0
    const updated = uploadTasks.map((task) => {
      if (task.status === 'queued' && started < available) {
        started++
        return { ...task, status: 'uploading' as const }
      }
      return task
    })

    if (started > 0) {
      set({ uploadTasks: updated })
    }
  }

  return {
    uploadTasks: [],
    maxConcurrent: 3,
    folders: [],
    documents: [],
    currentKbId: null,
    currentFolderId: null,
    isLoading: false,
    error: null,

    breadcrumb: () => {
      const { folders, currentFolderId } = get()
      const path: Folder[] = []
      let fid = currentFolderId
      while (fid) {
        const f = folders.find((x) => x.id === fid)
        if (!f) break
        path.unshift(f)
        fid = f.parentId
      }
      return path
    },

    activeUploadCount: () => {
      return get().uploadTasks.filter((t) => t.status === 'uploading').length
    },

    addTask: (task): string => {
      const id = crypto.randomUUID()
      const newTask: UploadTask = {
        ...task,
        id,
        progress: 0,
        status: 'queued',
      }
      set({ uploadTasks: [...get().uploadTasks, newTask] })
      return id
    },

    updateProgress: (taskId, progress) => {
      set({
        uploadTasks: get().uploadTasks.map((t) =>
          t.id === taskId && t.status === 'uploading' ? { ...t, progress } : t,
        ),
      })
    },

    markComplete: (taskId) => {
      set({
        uploadTasks: get().uploadTasks.map((t) =>
          t.id === taskId && t.status === 'uploading'
            ? { ...t, status: 'completed' as const, progress: 100 }
            : t,
        ),
      })
      processQueue()
    },

    markFailed: (taskId, error) => {
      set({
        uploadTasks: get().uploadTasks.map((t) =>
          t.id === taskId && t.status === 'uploading'
            ? { ...t, status: 'failed' as const, error }
            : t,
        ),
      })
      processQueue()
    },

    removeTask: (taskId) => {
      set({ uploadTasks: get().uploadTasks.filter((t) => t.id !== taskId) })
    },

    clearCompleted: () => {
      set({
        uploadTasks: get().uploadTasks.filter(
          (t) => t.status === 'uploading' || t.status === 'queued',
        ),
      })
    },

    processQueue,

    loadItems: async (kbId, folderId = null) => {
      set({ currentKbId: kbId, currentFolderId: folderId, isLoading: true, error: null })
      try {
        const [folders, documents] = await Promise.all([
          getFolders(kbId, folderId).send(),
          getDocuments(kbId, folderId).send(),
        ])
        set({
          folders: (folders as Folder[]) ?? [],
          documents: (documents as DocumentItem[]) ?? [],
          isLoading: false,
        })
      } catch (e) {
        set({
          error: e instanceof Error ? e.message : '加载失败',
          isLoading: false,
        })
      }
    },

    deleteDocument: async (docId) => {
      const { currentKbId } = get()
      if (!currentKbId) return
      set({ isLoading: true, error: null })
      try {
        await apiDeleteDocument(currentKbId, docId).send()
        set({
          documents: get().documents.filter((d) => d.id !== docId),
          isLoading: false,
        })
      } catch (e) {
        set({
          error: e instanceof Error ? e.message : '删除失败',
          isLoading: false,
        })
      }
    },

    renameDocument: async (docId, name) => {
      const { currentKbId } = get()
      if (!currentKbId) return
      set({ isLoading: true, error: null })
      try {
        const updated = await apiRenameDocument(currentKbId, docId, name).send()
        set({
          documents: get().documents.map((d) => (d.id === docId ? (updated as DocumentItem) : d)),
          isLoading: false,
        })
      } catch (e) {
        set({
          error: e instanceof Error ? e.message : '重命名失败',
          isLoading: false,
        })
      }
    },

    moveDocument: async (docId, targetFolderId) => {
      const { currentKbId } = get()
      if (!currentKbId) return
      set({ isLoading: true, error: null })
      try {
        await apiMoveDocument(currentKbId, docId, targetFolderId).send()
        set({
          documents: get().documents.filter((d) => d.id !== docId),
          isLoading: false,
        })
      } catch (e) {
        set({
          error: e instanceof Error ? e.message : '移动失败',
          isLoading: false,
        })
      }
    },

    createFolder: async (kbId, name, parentId = null) => {
      const updated = await apiCreateFolder(kbId, name, parentId).send()
      return updated as Folder
    },

    renameFolder: async (kbId, folderId, name) => {
      const updated = await apiRenameFolder(kbId, folderId, name).send()
      return updated as Folder
    },

    deleteFolder: async (kbId, folderId) => {
      await apiDeleteFolder(kbId, folderId).send()
    },

    clearError: () => set({ error: null }),

    resetFileBrowse: () =>
      set({
        folders: [],
        documents: [],
        currentKbId: null,
        currentFolderId: null,
      }),
  }
})
