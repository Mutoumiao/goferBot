import type { KbEntry } from '@goferbot/data'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useKbStore } from '@/features/KnowledgeBase/store'
import type { DocumentItem, Folder } from '@/features/KnowledgeBase/types'

describe('useKbStore', () => {
  beforeEach(() => {
    useKbStore.setState(
      useKbStore.getInitialState?.() ?? {
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
      },
    )
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
      expect(state.breadcrumbs).toHaveLength(0)
    })
  })

  describe('知识库列表状态', () => {
    it('sets entries', () => {
      const entries: KbEntry[] = [
        {
          id: 'kb1',
          name: 'Test KB',
          description: 'desc',
          fileCount: 0,
          createdAt: '',
          updatedAt: '',
        },
      ]
      useKbStore.getState().setEntries(entries)
      expect(useKbStore.getState().entries).toEqual(entries)
    })

    it('adds entry', () => {
      const entry: KbEntry = {
        id: 'kb1',
        name: 'Test',
        description: '',
        fileCount: 0,
        createdAt: '',
        updatedAt: '',
      }
      useKbStore.getState().addEntry(entry)
      expect(useKbStore.getState().entries).toHaveLength(1)
      expect(useKbStore.getState().entries[0].id).toBe('kb1')
    })

    it('updates entry by id', () => {
      const entry: KbEntry = {
        id: 'kb1',
        name: 'Test',
        description: '',
        fileCount: 0,
        createdAt: '',
        updatedAt: '',
      }
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
      const folders: Folder[] = [
        { id: 'f1', kbId: 'kb1', parentId: null, name: 'Folder', createdAt: '', updatedAt: '' },
      ]
      useKbStore.getState().setFolders(folders)
      expect(useKbStore.getState().folders).toEqual(folders)
    })

    it('sets documents', () => {
      const docs: DocumentItem[] = [
        {
          id: 'd1',
          kbId: 'kb1',
          folderId: null,
          name: 'doc',
          ext: 'pdf',
          mimeType: 'application/pdf',
          size: 1024,
          status: 'ready',
          createdAt: '',
          updatedAt: '',
        },
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

    it('sets breadcrumbs', () => {
      const breadcrumbs: Folder[] = [
        { id: 'f1', kbId: 'kb1', parentId: null, name: 'Root', createdAt: '', updatedAt: '' },
        { id: 'f2', kbId: 'kb1', parentId: 'f1', name: 'Child', createdAt: '', updatedAt: '' },
      ]
      useKbStore.getState().setBreadcrumbs(breadcrumbs)
      expect(useKbStore.getState().breadcrumbs).toEqual(breadcrumbs)
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
      useKbStore
        .getState()
        .addUploadTask({ fileName: 'test.pdf', fileSize: 1024, kbId: 'kb1', folderId: null })
      // manually set to uploading to allow progress update
      useKbStore.setState((s) => ({
        uploadTasks: s.uploadTasks.map((t) => ({ ...t, status: 'uploading' as const })),
      }))
      useKbStore.getState().updateUploadProgress('uuid-1', 50)
      expect(useKbStore.getState().uploadTasks[0].progress).toBe(50)
      vi.unstubAllGlobals()
    })

    it('marks upload as complete and drops file blob', () => {
      vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'uuid-1') })
      const file = new File(['x'], 'test.pdf', { type: 'application/pdf' })
      useKbStore.getState().addUploadTask({
        fileName: 'test.pdf',
        fileSize: 1024,
        kbId: 'kb1',
        folderId: null,
        file,
      })
      useKbStore.setState((s) => ({
        uploadTasks: s.uploadTasks.map((t) => ({ ...t, status: 'uploading' as const })),
      }))
      useKbStore.getState().markUploadComplete('uuid-1')
      const task = useKbStore.getState().uploadTasks[0]
      expect(task.status).toBe('completed')
      expect(task.progress).toBe(100)
      expect(task.file).toBeUndefined()
      vi.unstubAllGlobals()
    })

    it('marks upload as failed', () => {
      vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'uuid-1') })
      useKbStore
        .getState()
        .addUploadTask({ fileName: 'test.pdf', fileSize: 1024, kbId: 'kb1', folderId: null })
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
      useKbStore
        .getState()
        .addUploadTask({ fileName: 'test.pdf', fileSize: 1024, kbId: 'kb1', folderId: null })
      useKbStore.getState().removeUploadTask('uuid-1')
      expect(useKbStore.getState().uploadTasks).toHaveLength(0)
      vi.unstubAllGlobals()
    })

    it('clears only completed uploads and keeps failed', () => {
      vi.stubGlobal('crypto', {
        randomUUID: vi
          .fn()
          .mockReturnValueOnce('uuid-1')
          .mockReturnValueOnce('uuid-2')
          .mockReturnValueOnce('uuid-3'),
      })
      useKbStore
        .getState()
        .addUploadTask({ fileName: 'a.pdf', fileSize: 1024, kbId: 'kb1', folderId: null })
      useKbStore
        .getState()
        .addUploadTask({ fileName: 'b.pdf', fileSize: 2048, kbId: 'kb1', folderId: null })
      useKbStore
        .getState()
        .addUploadTask({ fileName: 'c.pdf', fileSize: 512, kbId: 'kb1', folderId: null })
      useKbStore.setState((s) => ({
        uploadTasks: s.uploadTasks.map((t, i) => {
          if (i === 0) return { ...t, status: 'completed' as const }
          if (i === 1) return { ...t, status: 'failed' as const, error: 'err' }
          return { ...t, status: 'uploading' as const }
        }),
      }))
      useKbStore.getState().clearCompletedUploads()
      const remaining = useKbStore.getState().uploadTasks
      expect(remaining).toHaveLength(2)
      expect(remaining.map((t) => t.id).sort()).toEqual(['uuid-2', 'uuid-3'])
      expect(remaining.find((t) => t.id === 'uuid-2')?.status).toBe('failed')
      vi.unstubAllGlobals()
    })

    it('returns active upload count', () => {
      vi.stubGlobal('crypto', {
        randomUUID: vi.fn().mockReturnValueOnce('uuid-1').mockReturnValueOnce('uuid-2'),
      })
      useKbStore
        .getState()
        .addUploadTask({ fileName: 'a.pdf', fileSize: 1024, kbId: 'kb1', folderId: null })
      useKbStore
        .getState()
        .addUploadTask({ fileName: 'b.pdf', fileSize: 2048, kbId: 'kb1', folderId: null })
      useKbStore.setState((s) => ({
        uploadTasks: s.uploadTasks.map((t, i) =>
          i === 0 ? { ...t, status: 'uploading' as const } : { ...t, status: 'queued' as const },
        ),
      }))
      expect(useKbStore.getState().activeUploadCount()).toBe(1)
      vi.unstubAllGlobals()
    })

    it('returns pending upload count as queued + uploading', () => {
      vi.stubGlobal('crypto', {
        randomUUID: vi
          .fn()
          .mockReturnValueOnce('uuid-1')
          .mockReturnValueOnce('uuid-2')
          .mockReturnValueOnce('uuid-3'),
      })
      useKbStore
        .getState()
        .addUploadTask({ fileName: 'a.pdf', fileSize: 1024, kbId: 'kb1', folderId: null })
      useKbStore
        .getState()
        .addUploadTask({ fileName: 'b.pdf', fileSize: 2048, kbId: 'kb1', folderId: null })
      useKbStore
        .getState()
        .addUploadTask({ fileName: 'c.pdf', fileSize: 512, kbId: 'kb1', folderId: null })
      useKbStore.setState((s) => ({
        uploadTasks: s.uploadTasks.map((t, i) => {
          if (i === 0) return { ...t, status: 'uploading' as const }
          if (i === 1) return { ...t, status: 'queued' as const }
          return { ...t, status: 'failed' as const, error: 'x' }
        }),
      }))
      expect(useKbStore.getState().pendingUploadCount()).toBe(2)
      vi.unstubAllGlobals()
    })

    it('resets uploadMiniDismissed when adding upload task', () => {
      vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'uuid-1') })
      useKbStore.getState().setUploadMiniDismissed(true)
      useKbStore
        .getState()
        .addUploadTask({ fileName: 'a.pdf', fileSize: 1024, kbId: 'kb1', folderId: null })
      expect(useKbStore.getState().uploadMiniDismissed).toBe(false)
      vi.unstubAllGlobals()
    })

    it('sets upload manager open flag', () => {
      useKbStore.getState().setUploadManagerOpen(true)
      expect(useKbStore.getState().uploadManagerOpen).toBe(true)
      useKbStore.getState().setUploadManagerOpen(false)
      expect(useKbStore.getState().uploadManagerOpen).toBe(false)
    })
  })

  describe('breadcrumb 状态', () => {
    it('has empty breadcrumbs by default', () => {
      expect(useKbStore.getState().breadcrumbs).toHaveLength(0)
    })

    it('sets breadcrumbs from server', () => {
      const breadcrumbs: Folder[] = [
        { id: 'f1', kbId: 'kb1', parentId: null, name: 'Root', createdAt: '', updatedAt: '' },
        { id: 'f2', kbId: 'kb1', parentId: 'f1', name: 'Child', createdAt: '', updatedAt: '' },
        { id: 'f3', kbId: 'kb1', parentId: 'f2', name: 'GrandChild', createdAt: '', updatedAt: '' },
      ]
      useKbStore.getState().setBreadcrumbs(breadcrumbs)
      expect(useKbStore.getState().breadcrumbs).toHaveLength(3)
      expect(useKbStore.getState().breadcrumbs.map((f) => f.name)).toEqual([
        'Root',
        'Child',
        'GrandChild',
      ])
    })
  })
})
