import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/api/KnowledgeBase', () => ({
  getKbList: vi.fn(() => ({ send: vi.fn() })),
  uploadFile: vi.fn(() => ({ send: vi.fn() })),
}))

vi.mock('@/api/file', () => ({
  getFolders: vi.fn(() => ({ send: vi.fn() })),
  getDocuments: vi.fn(() => ({ send: vi.fn() })),
  deleteDocument: vi.fn(() => ({ send: vi.fn() })),
  renameDocument: vi.fn(() => ({ send: vi.fn() })),
  moveDocument: vi.fn(() => ({ send: vi.fn() })),
  createFolder: vi.fn(() => ({ send: vi.fn() })),
  renameFolder: vi.fn(() => ({ send: vi.fn() })),
  deleteFolder: vi.fn(() => ({ send: vi.fn() })),
}))

import { getKbList, uploadFile } from '@/api/KnowledgeBase'
import {
  getFolders,
  getDocuments,
  deleteDocument,
  renameDocument,
  moveDocument,
  createFolder,
  renameFolder,
  deleteFolder,
} from '@/api/file'
import { useKbStore } from '@/features/KnowledgeBase/store'
import {
  fetchKbList,
  loadKbItems,
  removeDocument,
  renameDocument as svcRenameDocument,
  moveDocument as svcMoveDocument,
  createFolder as svcCreateFolder,
  renameFolder as svcRenameFolder,
  removeFolder as svcRemoveFolder,
  removeItem,
  renameItem,
  addFolder,
  uploadFiles,
  navigateToFolder,
} from '@/features/KnowledgeBase/services'
import type { KbEntry } from '@goferbot/data'
import type { Folder, DocumentItem } from '@/features/KnowledgeBase/types'

describe('kb services', () => {
  beforeEach(() => {
    useKbStore.setState({
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
    vi.clearAllMocks()
  })

  describe('fetchKbList', () => {
    it('returns success and sets entries on ok', async () => {
      const entries: KbEntry[] = [{ id: 'kb1', name: 'Test', description: '', fileCount: 0, createdAt: '', updatedAt: '' }]
      vi.mocked(getKbList).mockReturnValue({ send: vi.fn().mockResolvedValue({ entries }) } as any)

      const result = await fetchKbList()

      expect(result.success).toBe(true)
      expect(useKbStore.getState().entries).toEqual(entries)
      expect(useKbStore.getState().isLoading).toBe(false)
    })

    it('returns error on failure', async () => {
      vi.mocked(getKbList).mockReturnValue({ send: vi.fn().mockRejectedValue(new Error('network')) } as any)

      const result = await fetchKbList()

      expect(result.success).toBe(false)
      expect(result.error).toBe('network')
      expect(useKbStore.getState().isLoading).toBe(false)
    })

    it('returns generic error on non-Error throw', async () => {
      vi.mocked(getKbList).mockReturnValue({ send: vi.fn().mockRejectedValue('bad') } as any)

      const result = await fetchKbList()

      expect(result.success).toBe(false)
      expect(result.error).toBe('加载知识库列表失败')
    })
  })

  describe('loadKbItems', () => {
    it('sets folders and documents on success', async () => {
      const folders: Folder[] = [{ id: 'f1', kbId: 'kb1', parentId: null, name: 'F', createdAt: '', updatedAt: '' }]
      const documents: DocumentItem[] = [
        { id: 'd1', kbId: 'kb1', folderId: null, name: 'doc', ext: 'pdf', mimeType: 'application/pdf', size: 1024, status: 'ready', createdAt: '', updatedAt: '' },
      ]
      vi.mocked(getFolders).mockReturnValue({ send: vi.fn().mockResolvedValue(folders) } as any)
      vi.mocked(getDocuments).mockReturnValue({ send: vi.fn().mockResolvedValue(documents) } as any)

      await loadKbItems('kb1', 'f1')

      expect(useKbStore.getState().currentKbId).toBe('kb1')
      expect(useKbStore.getState().currentFolderId).toBe('f1')
      expect(useKbStore.getState().folders).toEqual(folders)
      expect(useKbStore.getState().documents).toEqual(documents)
      expect(useKbStore.getState().fileLoading).toBe(false)
    })

    it('sets fileError on failure', async () => {
      vi.mocked(getFolders).mockReturnValue({ send: vi.fn().mockRejectedValue(new Error('fail')) } as any)
      vi.mocked(getDocuments).mockReturnValue({ send: vi.fn().mockResolvedValue([]) } as any)

      await loadKbItems('kb1', null)

      expect(useKbStore.getState().fileError).toBe('fail')
      expect(useKbStore.getState().fileLoading).toBe(false)
    })
  })

  describe('removeDocument', () => {
    it('removes document from store after api success', async () => {
      useKbStore.setState({
        currentKbId: 'kb1',
        documents: [
          { id: 'd1', kbId: 'kb1', folderId: null, name: 'a', ext: 'pdf', mimeType: 'application/pdf', size: 1024, status: 'ready', createdAt: '', updatedAt: '' },
          { id: 'd2', kbId: 'kb1', folderId: null, name: 'b', ext: 'pdf', mimeType: 'application/pdf', size: 1024, status: 'ready', createdAt: '', updatedAt: '' },
        ],
      })
      vi.mocked(deleteDocument).mockReturnValue({ send: vi.fn().mockResolvedValue(undefined) } as any)

      await removeDocument('d1')

      expect(useKbStore.getState().documents).toHaveLength(1)
      expect(useKbStore.getState().documents[0].id).toBe('d2')
    })

    it('does nothing when currentKbId is null', async () => {
      useKbStore.setState({ currentKbId: null, documents: [{ id: 'd1', kbId: '', folderId: null, name: 'a', ext: 'pdf', mimeType: 'application/pdf', size: 1024, status: 'ready', createdAt: '', updatedAt: '' }] })
      await removeDocument('d1')
      expect(deleteDocument).not.toHaveBeenCalled()
    })

    it('sets fileError on api failure', async () => {
      useKbStore.setState({ currentKbId: 'kb1', documents: [{ id: 'd1', kbId: 'kb1', folderId: null, name: 'a', ext: 'pdf', mimeType: 'application/pdf', size: 1024, status: 'ready', createdAt: '', updatedAt: '' }] })
      vi.mocked(deleteDocument).mockReturnValue({ send: vi.fn().mockRejectedValue(new Error('del fail')) } as any)

      await removeDocument('d1')

      expect(useKbStore.getState().fileError).toBe('del fail')
    })
  })

  describe('renameDocument', () => {
    it('updates document in store after api success', async () => {
      useKbStore.setState({
        currentKbId: 'kb1',
        documents: [{ id: 'd1', kbId: 'kb1', folderId: null, name: 'old', ext: 'pdf', mimeType: 'application/pdf', size: 1024, status: 'ready', createdAt: '', updatedAt: '' }],
      })
      const updated: DocumentItem = { id: 'd1', kbId: 'kb1', folderId: null, name: 'new', ext: 'pdf', mimeType: 'application/pdf', size: 1024, status: 'ready', createdAt: '', updatedAt: '' }
      vi.mocked(renameDocument).mockReturnValue({ send: vi.fn().mockResolvedValue(updated) } as any)

      await svcRenameDocument('d1', 'new')

      expect(useKbStore.getState().documents[0].name).toBe('new')
    })
  })

  describe('moveDocument', () => {
    it('removes document from current list after api success', async () => {
      useKbStore.setState({
        currentKbId: 'kb1',
        documents: [{ id: 'd1', kbId: 'kb1', folderId: null, name: 'a', ext: 'pdf', mimeType: 'application/pdf', size: 1024, status: 'ready', createdAt: '', updatedAt: '' }],
      })
      vi.mocked(moveDocument).mockReturnValue({ send: vi.fn().mockResolvedValue(undefined) } as any)

      await svcMoveDocument('d1', 'f2')

      expect(useKbStore.getState().documents).toHaveLength(0)
    })
  })

  describe('createFolder', () => {
    it('returns created folder from api', async () => {
      const folder: Folder = { id: 'f1', kbId: 'kb1', parentId: null, name: 'New', createdAt: '', updatedAt: '' }
      vi.mocked(createFolder).mockReturnValue({ send: vi.fn().mockResolvedValue(folder) } as any)

      const result = await svcCreateFolder('kb1', 'New')

      expect(result).toEqual(folder)
    })
  })

  describe('renameFolder', () => {
    it('returns updated folder from api', async () => {
      const folder: Folder = { id: 'f1', kbId: 'kb1', parentId: null, name: 'Renamed', createdAt: '', updatedAt: '' }
      vi.mocked(renameFolder).mockReturnValue({ send: vi.fn().mockResolvedValue(folder) } as any)

      const result = await svcRenameFolder('kb1', 'f1', 'Renamed')

      expect(result).toEqual(folder)
    })
  })

  describe('removeFolder', () => {
    it('calls api delete', async () => {
      vi.mocked(deleteFolder).mockReturnValue({ send: vi.fn().mockResolvedValue(undefined) } as any)

      await svcRemoveFolder('kb1', 'f1')

      expect(deleteFolder).toHaveBeenCalledWith('kb1', 'f1')
    })
  })

  describe('uploadFiles', () => {
    it('adds upload tasks and marks complete on success', async () => {
      vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'uuid-1') })
      vi.mocked(uploadFile).mockReturnValue({ send: vi.fn().mockResolvedValue(undefined) } as any)

      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const ids = await uploadFiles('kb1', [file])

      expect(ids).toEqual(['uuid-1'])
      const tasks = useKbStore.getState().uploadTasks
      expect(tasks).toHaveLength(1)
      // store marks complete only when status is uploading; service sets it before api call
      expect(tasks[0].status).toBe('completed')
      vi.unstubAllGlobals()
    })

    it('marks upload failed on error', async () => {
      vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'uuid-1') })
      vi.mocked(uploadFile).mockReturnValue({ send: vi.fn().mockRejectedValue(new Error('up fail')) } as any)

      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      await uploadFiles('kb1', [file])

      const tasks = useKbStore.getState().uploadTasks
      expect(tasks[0].status).toBe('failed')
      expect(tasks[0].error).toBe('up fail')
      vi.unstubAllGlobals()
    })
  })

  describe('navigateToFolder', () => {
    it('sets current folder id when kb selected', () => {
      useKbStore.setState({ currentKbId: 'kb1' })
      navigateToFolder('f1')
      expect(useKbStore.getState().currentFolderId).toBe('f1')
    })

    it('does nothing when no kb selected', () => {
      useKbStore.setState({ currentKbId: null })
      navigateToFolder('f1')
      expect(useKbStore.getState().currentFolderId).toBeNull()
    })
  })

  describe('removeItem', () => {
    it('removes folder from store after api success', async () => {
      useKbStore.setState({
        currentKbId: 'kb1',
        folders: [
          { id: 'f1', kbId: 'kb1', parentId: null, name: 'A', createdAt: '', updatedAt: '' },
          { id: 'f2', kbId: 'kb1', parentId: null, name: 'B', createdAt: '', updatedAt: '' },
        ],
      })
      vi.mocked(deleteFolder).mockReturnValue({ send: vi.fn().mockResolvedValue(undefined) } as any)

      await removeItem({ id: 'f1', kbId: 'kb1', parentId: null, name: 'A', createdAt: '', updatedAt: '' })

      expect(useKbStore.getState().folders).toHaveLength(1)
      expect(useKbStore.getState().folders[0].id).toBe('f2')
    })

    it('removes document from store after api success', async () => {
      useKbStore.setState({
        currentKbId: 'kb1',
        documents: [
          { id: 'd1', kbId: 'kb1', folderId: null, name: 'a', ext: 'pdf', mimeType: 'application/pdf', size: 1024, status: 'ready', createdAt: '', updatedAt: '' },
        ],
      })
      vi.mocked(deleteDocument).mockReturnValue({ send: vi.fn().mockResolvedValue(undefined) } as any)

      await removeItem({ id: 'd1', kbId: 'kb1', folderId: null, name: 'a', ext: 'pdf', mimeType: 'application/pdf', size: 1024, status: 'ready', createdAt: '', updatedAt: '' })

      expect(useKbStore.getState().documents).toHaveLength(0)
    })

    it('does nothing when currentKbId is null', async () => {
      useKbStore.setState({ currentKbId: null, folders: [{ id: 'f1', kbId: '', parentId: null, name: 'A', createdAt: '', updatedAt: '' }] })
      await removeItem({ id: 'f1', kbId: '', parentId: null, name: 'A', createdAt: '', updatedAt: '' })
      expect(deleteFolder).not.toHaveBeenCalled()
    })
  })

  describe('renameItem', () => {
    it('renames folder in store after api success', async () => {
      useKbStore.setState({
        currentKbId: 'kb1',
        folders: [{ id: 'f1', kbId: 'kb1', parentId: null, name: 'Old', createdAt: '', updatedAt: '' }],
      })
      const updated: Folder = { id: 'f1', kbId: 'kb1', parentId: null, name: 'New', createdAt: '', updatedAt: '' }
      vi.mocked(renameFolder).mockReturnValue({ send: vi.fn().mockResolvedValue(updated) } as any)

      await renameItem({ id: 'f1', kbId: 'kb1', parentId: null, name: 'Old', createdAt: '', updatedAt: '' }, 'New')

      expect(useKbStore.getState().folders[0].name).toBe('New')
    })

    it('renames document in store after api success', async () => {
      useKbStore.setState({
        currentKbId: 'kb1',
        documents: [{ id: 'd1', kbId: 'kb1', folderId: null, name: 'old', ext: 'pdf', mimeType: 'application/pdf', size: 1024, status: 'ready', createdAt: '', updatedAt: '' }],
      })
      const updated: DocumentItem = { id: 'd1', kbId: 'kb1', folderId: null, name: 'new', ext: 'pdf', mimeType: 'application/pdf', size: 1024, status: 'ready', createdAt: '', updatedAt: '' }
      vi.mocked(renameDocument).mockReturnValue({ send: vi.fn().mockResolvedValue(updated) } as any)

      await renameItem({ id: 'd1', kbId: 'kb1', folderId: null, name: 'old', ext: 'pdf', mimeType: 'application/pdf', size: 1024, status: 'ready', createdAt: '', updatedAt: '' }, 'new')

      expect(useKbStore.getState().documents[0].name).toBe('new')
    })
  })

  describe('addFolder', () => {
    it('adds folder to store after api success', async () => {
      useKbStore.setState({ currentKbId: 'kb1', folders: [] })
      const folder: Folder = { id: 'f1', kbId: 'kb1', parentId: null, name: 'New', createdAt: '', updatedAt: '' }
      vi.mocked(createFolder).mockReturnValue({ send: vi.fn().mockResolvedValue(folder) } as any)

      const result = await addFolder('kb1', 'New')

      expect(result).toEqual(folder)
      expect(useKbStore.getState().folders).toHaveLength(1)
    })

    it('sets fileError on api failure', async () => {
      useKbStore.setState({ currentKbId: 'kb1', folders: [] })
      vi.mocked(createFolder).mockReturnValue({ send: vi.fn().mockRejectedValue(new Error('fail')) } as any)

      await expect(addFolder('kb1', 'New')).rejects.toThrow('fail')
      expect(useKbStore.getState().fileError).toBe('fail')
    })
  })

  describe('uploadFiles', () => {
    it('saves file object in task for retry', async () => {
      vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'uuid-1') })
      vi.mocked(uploadFile).mockReturnValue({ send: vi.fn().mockResolvedValue(undefined) } as any)

      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      await uploadFiles('kb1', [file])

      const task = useKbStore.getState().uploadTasks[0]
      expect(task.file).toBe(file)
      vi.unstubAllGlobals()
    })
  })
})
