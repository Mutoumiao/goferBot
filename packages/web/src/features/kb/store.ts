import { create } from 'zustand'
import type { KbEntry } from '@goferbot/data'
import type { Folder, DocumentItem, UploadTask } from './types'

export type { Folder, DocumentItem, UploadTask }

interface KbState {
  entries: KbEntry[]
  isLoading: boolean
  selectedId: string | null

  uploadTasks: UploadTask[]
  maxConcurrent: number
  folders: Folder[]
  documents: DocumentItem[]
  currentKbId: string | null
  currentFolderId: string | null
  fileLoading: boolean
  fileError: string | null

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

  addUploadTask: (task: Omit<UploadTask, 'id' | 'progress' | 'status'>) => string
  updateUploadProgress: (taskId: string, progress: number) => void
  markUploadComplete: (taskId: string) => void
  markUploadFailed: (taskId: string, error: string) => void
  removeUploadTask: (taskId: string) => void
  clearCompletedUploads: () => void

  breadcrumb: () => Folder[]
  activeUploadCount: () => number
}

export const useKbStore = create<KbState>((set, get) => ({
  entries: [],
  isLoading: false,
  selectedId: null,

  uploadTasks: [],
  maxConcurrent: 3,
  folders: [],
  documents: [],
  currentKbId: null,
  currentFolderId: null,
  fileLoading: false,
  fileError: null,

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

  addUploadTask: (task): string => {
    const id = crypto.randomUUID()
    const newTask: UploadTask = { ...task, id, progress: 0, status: 'queued' }
    set({ uploadTasks: [...get().uploadTasks, newTask] })
    return id
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
          ? { ...t, status: 'completed' as const, progress: 100 }
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
      uploadTasks: get().uploadTasks.filter(
        (t) => t.status === 'uploading' || t.status === 'queued',
      ),
    })
  },

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
}))
