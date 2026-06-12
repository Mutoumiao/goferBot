import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useKbStore } from '@/features/KnowledgeBase/store'
import type { KbEntry } from '@goferbot/data'
import type { Folder, DocumentItem } from '@/features/KnowledgeBase/types'

describe('useKbStore', () => {
  beforeEach(() => {
    useKbStore.setState(useKbStore.getInitialState?.() ?? {
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
    })
  })

  describe('初始状态', () => {
    it('has default empty state', () => {
      const state = useKbStore.getState()
      expect(state.entries).toHaveLength(0)
      expect(state.isLoading).toBe(false)
      expect(state.selectedId).toBeNull()
      expect(state.uploadTasks).toHaveLength(0)
      expect(state.folders).toHaveLength(0)
      expect(state.documents).toHaveLength(0)
      expect(state.currentKbId).toBeNull()
      expect(state.currentFolderId).toBeNull()
      expect(state.fileLoading).toBe(false)
      expect(state.fileError).toBeNull()
    })
  })

  describe('知识库列表状态', () => {
    it('sets entries', () => {
      const entries: KbEntry[] = [
        { id: 'kb1', name: 'Test KB', description: 'desc', fileCount: 0, createdAt: '', updatedAt: '' },
      ]
      useKbStore.getState().setEntries(entries)
      expect(useKbStore.getState().entries).toEqual(entries)
    })

    it('adds entry', () => {
      const entry: KbEntry = { id: 'kb1', name: 'Test', description: '', fileCount: 0, createdAt: '', updatedAt: '' }
      useKbStore.getState().addEntry(entry)
      expect(useKbStore.getState().entries).toHaveLength(1)
      expect(useKbStore.getState().entries[0].id).toBe('kb1')
    })

    it('updates entry by id', () => {
      const entry: KbEntry = { id: 'kb1', name: 'Test', description: '', fileCount: 0, createdAt: '', updatedAt: '' }
      useKbStore.getState().setEntries([entry])
      useKbStore.getState().updateEntry('kb1', { name: 'Updated' })
      expect(useKbStore.getState().entries[0].name).toBe('Updated')
    })

    it('removes entry by id', () => {
      const entries: KbEntry[] = [
        { id: 'kb1', name: 'A', description: '', fileCount: 0, createdAt: '', updatedAt: '' },
        { id: 'kb2', name: 'B', description: '', fileCount: 0, createdAt: '', updatedAt: '' },
      ]
      useKbStore.getState().setEntries(entries)
      useKbStore.getState().removeEntry('kb1')
      expect(useKbStore.getState().entries).toHaveLength(1)
      expect(useKbStore.getState().entries[0].id).toBe('kb2')
    })

    it('sets loading state', () => {
      useKbStore.getState().setKbLoading(true)
      expect(useKbStore.getState().isLoading).toBe(true)
    })

    it('sets selected id', () => {
      useKbStore.getState().setSelectedId('kb1')
      expect(useKbStore.getState().selectedId).toBe('kb1')
    })
  })

  describe('文件浏览状态', () => {
    it('sets folders', () => {
      const folders: Folder[] = [{ id: 'f1', kbId: 'kb1', parentId: null, name: 'Folder', createdAt: '', updatedAt: '' }]
      useKbStore.getState().setFolders(folders)
      expect(useKbStore.getState().folders).toEqual(folders)
    })

    it('sets documents', () => {
      const docs: DocumentItem[] = [
        { id: 'd1', kbId: 'kb1', folderId: null, name: 'doc', ext: 'pdf', mimeType: 'application/pdf', size: 1024, status: 'ready', createdAt: '', updatedAt: '' },
      ]
      useKbStore.getState().setDocuments(docs)
      expect(useKbStore.getState().documents).toEqual(docs)
    })

    it('sets current kb and folder id', () => {
      useKbStore.getState().setCurrentKbId('kb1')
      useKbStore.getState().setCurrentFolderId('f1')
      expect(useKbStore.getState().currentKbId).toBe('kb1')
      expect(useKbStore.getState().currentFolderId).toBe('f1')
    })

    it('sets file loading and error', () => {
      useKbStore.getState().setFileLoading(true)
      useKbStore.getState().setFileError('network error')
      expect(useKbStore.getState().fileLoading).toBe(true)
      expect(useKbStore.getState().fileError).toBe('network error')
    })
  })

  describe('上传任务管理', () => {
    it('adds upload task and returns task id', () => {
      vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'uuid-1') })
      const id = useKbStore.getState().addUploadTask({
        fileName: 'test.pdf',
        fileSize: 1024,
        kbId: 'kb1',
        folderId: null,
      })
      expect(id).toBe('uuid-1')
      const tasks = useKbStore.getState().uploadTasks
      expect(tasks).toHaveLength(1)
      expect(tasks[0].status).toBe('queued')
      expect(tasks[0].progress).toBe(0)
      vi.unstubAllGlobals()
    })

    it('updates upload progress for uploading task', () => {
      vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'uuid-1') })
      useKbStore.getState().addUploadTask({ fileName: 'test.pdf', fileSize: 1024, kbId: 'kb1', folderId: null })
      // manually set to uploading to allow progress update
      useKbStore.setState((s) => ({
        uploadTasks: s.uploadTasks.map((t) => ({ ...t, status: 'uploading' as const })),
      }))
      useKbStore.getState().updateUploadProgress('uuid-1', 50)
      expect(useKbStore.getState().uploadTasks[0].progress).toBe(50)
      vi.unstubAllGlobals()
    })

    it('marks upload as complete', () => {
      vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'uuid-1') })
      useKbStore.getState().addUploadTask({ fileName: 'test.pdf', fileSize: 1024, kbId: 'kb1', folderId: null })
      useKbStore.setState((s) => ({
        uploadTasks: s.uploadTasks.map((t) => ({ ...t, status: 'uploading' as const })),
      }))
      useKbStore.getState().markUploadComplete('uuid-1')
      const task = useKbStore.getState().uploadTasks[0]
      expect(task.status).toBe('completed')
      expect(task.progress).toBe(100)
      vi.unstubAllGlobals()
    })

    it('marks upload as failed', () => {
      vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'uuid-1') })
      useKbStore.getState().addUploadTask({ fileName: 'test.pdf', fileSize: 1024, kbId: 'kb1', folderId: null })
      useKbStore.setState((s) => ({
        uploadTasks: s.uploadTasks.map((t) => ({ ...t, status: 'uploading' as const })),
      }))
      useKbStore.getState().markUploadFailed('uuid-1', 'upload error')
      const task = useKbStore.getState().uploadTasks[0]
      expect(task.status).toBe('failed')
      expect(task.error).toBe('upload error')
      vi.unstubAllGlobals()
    })

    it('removes upload task', () => {
      vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'uuid-1') })
      useKbStore.getState().addUploadTask({ fileName: 'test.pdf', fileSize: 1024, kbId: 'kb1', folderId: null })
      useKbStore.getState().removeUploadTask('uuid-1')
      expect(useKbStore.getState().uploadTasks).toHaveLength(0)
      vi.unstubAllGlobals()
    })

    it('clears completed uploads', () => {
      vi.stubGlobal('crypto', { randomUUID: vi.fn().mockReturnValueOnce('uuid-1').mockReturnValueOnce('uuid-2') })
      useKbStore.getState().addUploadTask({ fileName: 'a.pdf', fileSize: 1024, kbId: 'kb1', folderId: null })
      useKbStore.getState().addUploadTask({ fileName: 'b.pdf', fileSize: 2048, kbId: 'kb1', folderId: null })
      useKbStore.setState((s) => ({
        uploadTasks: s.uploadTasks.map((t, i) =>
          i === 0 ? { ...t, status: 'completed' as const } : { ...t, status: 'uploading' as const },
        ),
      }))
      useKbStore.getState().clearCompletedUploads()
      expect(useKbStore.getState().uploadTasks).toHaveLength(1)
      expect(useKbStore.getState().uploadTasks[0].id).toBe('uuid-2')
      vi.unstubAllGlobals()
    })

    it('returns active upload count', () => {
      vi.stubGlobal('crypto', { randomUUID: vi.fn().mockReturnValueOnce('uuid-1').mockReturnValueOnce('uuid-2') })
      useKbStore.getState().addUploadTask({ fileName: 'a.pdf', fileSize: 1024, kbId: 'kb1', folderId: null })
      useKbStore.getState().addUploadTask({ fileName: 'b.pdf', fileSize: 2048, kbId: 'kb1', folderId: null })
      useKbStore.setState((s) => ({
        uploadTasks: s.uploadTasks.map((t, i) =>
          i === 0 ? { ...t, status: 'uploading' as const } : { ...t, status: 'queued' as const },
        ),
      }))
      expect(useKbStore.getState().activeUploadCount()).toBe(1)
      vi.unstubAllGlobals()
    })
  })

  describe('breadcrumb 计算', () => {
    it('returns empty breadcrumb when no current folder', () => {
      expect(useKbStore.getState().breadcrumb()).toHaveLength(0)
    })

    it('builds breadcrumb from current folder up to root', () => {
      const folders: Folder[] = [
        { id: 'f1', kbId: 'kb1', parentId: null, name: 'Root', createdAt: '', updatedAt: '' },
        { id: 'f2', kbId: 'kb1', parentId: 'f1', name: 'Child', createdAt: '', updatedAt: '' },
        { id: 'f3', kbId: 'kb1', parentId: 'f2', name: 'GrandChild', createdAt: '', updatedAt: '' },
      ]
      useKbStore.getState().setFolders(folders)
      useKbStore.getState().setCurrentFolderId('f3')
      const breadcrumb = useKbStore.getState().breadcrumb()
      expect(breadcrumb).toHaveLength(3)
      expect(breadcrumb.map((f) => f.name)).toEqual(['Root', 'Child', 'GrandChild'])
    })

    it('stops breadcrumb when parent not found', () => {
      const folders: Folder[] = [
        { id: 'f1', kbId: 'kb1', parentId: 'missing', name: 'Orphan', createdAt: '', updatedAt: '' },
      ]
      useKbStore.getState().setFolders(folders)
      useKbStore.getState().setCurrentFolderId('f1')
      const breadcrumb = useKbStore.getState().breadcrumb()
      expect(breadcrumb).toHaveLength(1)
      expect(breadcrumb[0].name).toBe('Orphan')
    })
  })
})
