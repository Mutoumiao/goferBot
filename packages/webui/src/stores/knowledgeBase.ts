import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/api/client'
import type { KnowledgeBase, FileItem, SearchResultItem, HistoryEntry } from '@/types'

export const useKnowledgeBaseStore = defineStore('knowledgeBase', () => {
  // State
  const knowledgeBases = ref<KnowledgeBase[]>([])
  const selectedKbId = ref<string | null>(null)
  const files = ref<FileItem[]>([])
  const searchResults = ref<SearchResultItem[]>([])
  const searchQuery = ref('')
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const deletedKnowledgeBases = ref<KnowledgeBase[]>([])
  const indexStatus = ref<Map<string, { totalFiles: number; indexedFiles: number; pendingFiles: number }>>(new Map())

  // Navigation history stack
  const history = ref<HistoryEntry[]>([{ type: 'browse', path: '' }])
  const historyIndex = ref(0)

  // Getters
  const selectedKb = computed(() =>
    knowledgeBases.value.find((kb) => kb.id === selectedKbId.value)
  )

  const currentPath = computed(() => {
    const state = history.value[historyIndex.value]
    return state?.type === 'browse' ? state.path : ''
  })

  const canGoBack = computed(() => historyIndex.value > 0)
  const canGoForward = computed(() => historyIndex.value < history.value.length - 1)

  const breadcrumb = computed(() => {
    const state = history.value[historyIndex.value]
    if (state?.type !== 'browse') return []
    if (!state.path) return []
    return state.path.split('/').filter(Boolean)
  })

  // Actions
  async function loadKnowledgeBases() {
    isLoading.value = true
    error.value = null
    try {
      knowledgeBases.value = await api.get<KnowledgeBase[]>('/knowledge-bases')
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      isLoading.value = false
    }
  }

  async function createKnowledgeBase(name: string) {
    error.value = null
    try {
      const kb = await api.post<KnowledgeBase>('/knowledge-bases', { name })
      knowledgeBases.value.unshift(kb)
      selectKb(kb.id)
      return kb
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      throw e
    }
  }

  async function deleteKnowledgeBase(id: string) {
    error.value = null
    try {
      await api.delete(`/knowledge-bases/${id}`)
      knowledgeBases.value = knowledgeBases.value.filter((kb) => kb.id !== id)
      if (selectedKbId.value === id) {
        selectedKbId.value = null
        files.value = []
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  async function restoreKnowledgeBase(id: string) {
    error.value = null
    try {
      const kb = await api.post<KnowledgeBase>(`/knowledge-bases/${id}/restore`)
      knowledgeBases.value = knowledgeBases.value.filter((k) => k.id !== id)
      knowledgeBases.value.unshift(kb)
      deletedKnowledgeBases.value = deletedKnowledgeBases.value.filter((k) => k.id !== id)
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  async function permanentlyDeleteKnowledgeBase(id: string) {
    error.value = null
    try {
      await api.delete(`/knowledge-bases/${id}/permanent`)
      deletedKnowledgeBases.value = deletedKnowledgeBases.value.filter((k) => k.id !== id)
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  async function loadDeletedKnowledgeBases() {
    isLoading.value = true
    error.value = null
    try {
      deletedKnowledgeBases.value = await api.get<KnowledgeBase[]>('/knowledge-bases/deleted')
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      isLoading.value = false
    }
  }

  function selectKb(id: string) {
    selectedKbId.value = id
    history.value = [{ type: 'browse', path: '' }]
    historyIndex.value = 0
    searchQuery.value = ''
    searchResults.value = []
    loadFiles('')
  }

  async function loadFiles(path: string) {
    if (!selectedKbId.value) return
    isLoading.value = true
    try {
      const data = await api.get<{ items: FileItem[] }>(`/knowledge-bases/${selectedKbId.value}/files?path=${encodeURIComponent(path)}`)
      files.value = data.items
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      isLoading.value = false
    }
  }

  function pushHistory(entry: HistoryEntry) {
    // 截断当前索引之后的历史
    history.value = history.value.slice(0, historyIndex.value + 1)
    history.value.push(entry)
    historyIndex.value++

    if (entry.type === 'browse') {
      loadFiles(entry.path)
    }
  }

  function navigateToPath(path: string) {
    pushHistory({ type: 'browse', path })
  }

  async function searchFiles(query: string) {
    if (!selectedKbId.value || !query.trim()) {
      searchResults.value = []
      return
    }
    searchQuery.value = query
    isLoading.value = true
    try {
      const data = await api.get<{ results: SearchResultItem[] }>(`/knowledge-bases/${selectedKbId.value}/search?q=${encodeURIComponent(query)}`)
      searchResults.value = data.results
      pushHistory({ type: 'search', query })
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      isLoading.value = false
    }
  }

  function goBack() {
    if (!canGoBack.value) return
    historyIndex.value--
    applyHistoryState()
  }

  function goForward() {
    if (!canGoForward.value) return
    historyIndex.value++
    applyHistoryState()
  }

  function applyHistoryState() {
    const state = history.value[historyIndex.value]
    if (!state) return
    if (state.type === 'browse') {
      loadFiles(state.path)
    }
    // search state keeps results in searchResults
  }

  async function importFiles(fileList: FileList) {
    if (!selectedKbId.value) return
    const formData = new FormData()
    for (const file of fileList) {
      formData.append('files', file)
    }
    if (currentPath.value) {
      formData.append('path', currentPath.value)
    }
    try {
      const accessToken = localStorage.getItem('goferbot_access_token')
      const headers: Record<string, string> = {}
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`
      }
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/knowledge-bases/${selectedKbId.value}/files`,
        {
          method: 'POST',
          body: formData,
          headers,
        }
      )
      if (!res.ok) throw new Error('上传失败')
      await loadFiles(currentPath.value)
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  async function moveFile(sourceKbId: string, sourcePath: string, targetKbId: string, targetPath: string) {
    error.value = null
    try {
      await api.post('/knowledge-bases/move', { sourceKbId, sourcePath, targetKbId, targetPath })
      if (selectedKbId.value === sourceKbId || selectedKbId.value === targetKbId) {
        await loadFiles(currentPath.value)
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  async function copyFile(sourceKbId: string, sourcePath: string, targetKbId: string, targetPath: string) {
    error.value = null
    try {
      await api.post('/knowledge-bases/copy', { sourceKbId, sourcePath, targetKbId, targetPath })
      if (selectedKbId.value === targetKbId) {
        await loadFiles(currentPath.value)
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  async function renameKnowledgeBase(id: string, name: string) {
    error.value = null
    try {
      const updated = await api.patch<KnowledgeBase>(`/knowledge-bases/${id}`, { name })
      const idx = knowledgeBases.value.findIndex((kb) => kb.id === id)
      if (idx !== -1) knowledgeBases.value[idx] = updated
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  async function updateKbIcon(id: string, icon: string) {
    error.value = null
    try {
      const updated = await api.patch<KnowledgeBase>(`/knowledge-bases/${id}`, { icon })
      const idx = knowledgeBases.value.findIndex((kb) => kb.id === id)
      if (idx !== -1) knowledgeBases.value[idx] = updated
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  async function togglePin(id: string) {
    const kb = knowledgeBases.value.find((k) => k.id === id)
    if (!kb) return
    error.value = null
    try {
      const updated = await api.patch<KnowledgeBase>(`/knowledge-bases/${id}`, { sort_order: Date.now() })
      const idx = knowledgeBases.value.findIndex((k) => k.id === id)
      if (idx !== -1) knowledgeBases.value[idx] = updated
      knowledgeBases.value = [...knowledgeBases.value].sort(
        (a, b) => b.sort_order - a.sort_order || b.created_at - a.created_at
      )
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  async function createFolder(name: string) {
    if (!selectedKbId.value) return
    error.value = null
    try {
      await api.post<{ name: string }>(`/knowledge-bases/${selectedKbId.value}/folders`, { name, path: currentPath.value })
      await loadFiles(currentPath.value)
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  async function renameFile(oldName: string, newName: string) {
    if (!selectedKbId.value) return
    error.value = null
    try {
      const relativePath = currentPath.value ? `${currentPath.value}/${oldName}` : oldName
      await api.patch(`/knowledge-bases/${selectedKbId.value}/files/${relativePath}`, { newName })
      await loadFiles(currentPath.value)
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  async function deleteFile(fileName: string) {
    if (!selectedKbId.value) return
    error.value = null
    try {
      const relativePath = currentPath.value ? `${currentPath.value}/${fileName}` : fileName
      await api.delete(`/knowledge-bases/${selectedKbId.value}/files/${relativePath}`)
      await loadFiles(currentPath.value)
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  async function loadIndexStatus(kbId: string) {
    try {
      const data = await api.get<{ totalFiles: number; indexedFiles: number; pendingFiles: number }>(`/knowledge-bases/${kbId}/index-status`)
      indexStatus.value.set(kbId, data)
    } catch (e) {
      console.error('Failed to load index status:', e)
    }
  }

  return {
    knowledgeBases,
    selectedKbId,
    selectedKb,
    files,
    searchResults,
    searchQuery,
    isLoading,
    error,
    history,
    historyIndex,
    currentPath,
    canGoBack,
    canGoForward,
    breadcrumb,
    deletedKnowledgeBases,
    indexStatus,
    loadKnowledgeBases,
    createKnowledgeBase,
    deleteKnowledgeBase,
    restoreKnowledgeBase,
    loadDeletedKnowledgeBases,
    permanentlyDeleteKnowledgeBase,
    selectKb,
    loadFiles,
    navigateToPath,
    searchFiles,
    goBack,
    goForward,
    importFiles,
    moveFile,
    copyFile,
    renameKnowledgeBase,
    updateKbIcon,
    togglePin,
    createFolder,
    renameFile,
    deleteFile,
    loadIndexStatus,
  }
})
