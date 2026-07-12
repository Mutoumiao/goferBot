import type { KbEntry } from '@goferbot/data'
import { create } from 'zustand'
import type { DocumentItem, Folder, ItemSortParams, UploadTask } from './types'

export type { DocumentItem, Folder, UploadTask }

interface KbState {
  entries: KbEntry[]
  isLoading: boolean
  selectedId: string | null

  uploadTasks: UploadTask[]
  maxConcurrent: number
  /** 上传管理弹窗是否打开（与迷你浮层互斥） */
  uploadManagerOpen: boolean
  /** 用户手动收起迷你浮层 */
  uploadMiniDismissed: boolean
  /** 文件列表当前排序（迷你浮层重开上传管理时复用） */
  fileListSort: ItemSortParams | null
  folders: Folder[]
  documents: DocumentItem[]
  currentKbId: string | null
  currentFolderId: string | null
  fileLoading: boolean
  fileError: string | null
  breadcrumbs: Folder[]

  setEntries: (entries: KbEntry[]) => void
  addEntry: (entry: KbEntry) => void
  updateEntry: (id: string, data: Partial<KbEntry>) => void
  removeEntry: (id: string) => void
  setKbLoading: (v: boolean) => void
  setSelectedId: (id: string | null) => void

  setFolders: (folders: Folder[]) => void
  setDocuments: (documents: DocumentItem[]) => void
  setCurrentKbId: (id: string | null) => void
  setCurrentFolderId: (id: string | null) => void
  setFileLoading: (v: boolean) => void
  setFileError: (error: string | null) => void
  setBreadcrumbs: (breadcrumbs: Folder[]) => void
  setFileListSort: (sort: ItemSortParams | null) => void

  setUploadManagerOpen: (open: boolean) => void
  setUploadMiniDismissed: (dismissed: boolean) => void

  addUploadTask: (task: Omit<UploadTask, 'id' | 'progress' | 'status'>) => string
  startUploadTask: (taskId: string) => void
  updateUploadProgress: (taskId: string, progress: number) => void
  markUploadComplete: (taskId: string) => void
  markUploadFailed: (taskId: string, error: string) => void
  removeUploadTask: (taskId: string) => void
  /** 仅移除 status === 'completed' 的任务，保留 failed 供重试 */
  clearCompletedUploads: () => void

  /** 仅计 uploading（兼容旧调用） */
  activeUploadCount: () => number
  /** 角标用：queued + uploading */
  pendingUploadCount: () => number
}

export const useKbStore = create<KbState>((set, get) => ({
  entries: [],
  isLoading: false,
  selectedId: null,

  uploadTasks: [],
  maxConcurrent: 3,
  uploadManagerOpen: false,
  uploadMiniDismissed: false,
  fileListSort: null,
  folders: [],
  documents: [],
  currentKbId: null,
  currentFolderId: null,
  fileLoading: false,
  fileError: null,
  breadcrumbs: [],

  setEntries: (entries) => set({ entries }),
  addEntry: (entry) => set((s) => ({ entries: [...s.entries, entry] })),
  updateEntry: (id, data) =>
    set((s) => ({
      entries: s.entries.map((e) => (e.id === id ? { ...e, ...data } : e)),
    })),
  removeEntry: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
  setKbLoading: (v) => set({ isLoading: v }),
  setSelectedId: (id) => set({ selectedId: id }),

  setFolders: (folders) => set({ folders }),
  setDocuments: (documents) => set({ documents }),
  setCurrentKbId: (id) => set({ currentKbId: id }),
  setCurrentFolderId: (id) => set({ currentFolderId: id }),
  setFileLoading: (v) => set({ fileLoading: v }),
  setFileError: (error) => set({ fileError: error }),
  setBreadcrumbs: (breadcrumbs) => set({ breadcrumbs }),
  setFileListSort: (sort) => set({ fileListSort: sort }),

  setUploadManagerOpen: (open) => set({ uploadManagerOpen: open }),
  setUploadMiniDismissed: (dismissed) => set({ uploadMiniDismissed: dismissed }),

  addUploadTask: (task): string => {
    const id = crypto.randomUUID()
    const newTask: UploadTask = { ...task, id, progress: 0, status: 'queued' }
    set({
      uploadTasks: [...get().uploadTasks, newTask],
      uploadMiniDismissed: false,
    })
    return id
  },

  startUploadTask: (taskId) => {
    set({
      uploadTasks: get().uploadTasks.map((t) =>
        t.id === taskId && t.status === 'queued' ? { ...t, status: 'uploading' as const } : t,
      ),
    })
  },

  updateUploadProgress: (taskId, progress) => {
    set({
      uploadTasks: get().uploadTasks.map((t) =>
        t.id === taskId && t.status === 'uploading' ? { ...t, progress } : t,
      ),
    })
  },

  markUploadComplete: (taskId) => {
    set({
      uploadTasks: get().uploadTasks.map((t) =>
        t.id === taskId && t.status === 'uploading'
          ? { ...t, status: 'completed' as const, progress: 100, file: undefined }
          : t,
      ),
    })
  },

  markUploadFailed: (taskId, error) => {
    set({
      uploadTasks: get().uploadTasks.map((t) =>
        t.id === taskId && t.status === 'uploading'
          ? { ...t, status: 'failed' as const, error }
          : t,
      ),
    })
  },

  removeUploadTask: (taskId) => {
    set({ uploadTasks: get().uploadTasks.filter((t) => t.id !== taskId) })
  },

  clearCompletedUploads: () => {
    set({
      uploadTasks: get().uploadTasks.filter((t) => t.status !== 'completed'),
    })
  },

  activeUploadCount: () => {
    return get().uploadTasks.filter((t) => t.status === 'uploading').length
  },

  pendingUploadCount: () => {
    return get().uploadTasks.filter((t) => t.status === 'queued' || t.status === 'uploading').length
  },
}))
