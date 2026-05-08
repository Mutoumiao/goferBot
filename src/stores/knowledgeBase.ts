import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { sidecarFetch } from '@/utils/sidecarClient'
import { invoke } from '@tauri-apps/api/core'
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
      const res = await sidecarFetch('/knowledge-bases')
      knowledgeBases.value = (await res.json()) as KnowledgeBase[]
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      isLoading.value = false
    }
  }

  async function createKnowledgeBase(name: string) {
    error.value = null
    try {
      const res = await sidecarFetch('/knowledge-bases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({ error: '创建失败' }))) as { error: string }
        throw new Error(err.error)
      }
      const kb = (await res.json()) as KnowledgeBase
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
      const res = await sidecarFetch(`/knowledge-bases/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('删除失败')
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
      const res = await sidecarFetch(`/knowledge-bases/${id}/restore`, { method: 'POST' })
      if (!res.ok) throw new Error('恢复失败')
      const kb = (await res.json()) as KnowledgeBase
      knowledgeBases.value = knowledgeBases.value.filter((k) => k.id !== id)
      knowledgeBases.value.unshift(kb)
      deletedKnowledgeBases.value = deletedKnowledgeBases.value.filter((k) => k.id !== id)
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  async function loadDeletedKnowledgeBases() {
    isLoading.value = true
    error.value = null
    try {
      const res = await sidecarFetch('/knowledge-bases/deleted')
      deletedKnowledgeBases.value = (await res.json()) as KnowledgeBase[]
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
      const res = await sidecarFetch(
        `/knowledge-bases/${selectedKbId.value}/files?path=${encodeURIComponent(path)}`
      )
      const data = (await res.json()) as { items: FileItem[] }
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
      const res = await sidecarFetch(
        `/knowledge-bases/${selectedKbId.value}/search?q=${encodeURIComponent(query)}`
      )
      const data = (await res.json()) as { results: SearchResultItem[] }
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

  async function importFiles() {
    if (!selectedKbId.value) return
    try {
      await invoke('import_files', {
        knowledgeBaseId: selectedKbId.value,
        targetPath: currentPath.value,
      })
      // 刷新当前目录
      await loadFiles(currentPath.value)
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  async function moveFile(sourceKbId: string, sourcePath: string, targetKbId: string, targetPath: string) {
    error.value = null
    try {
      const res = await sidecarFetch('/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceKbId, sourcePath, targetKbId, targetPath }),
      })
      if (!res.ok) throw new Error('移动失败')
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
      const res = await sidecarFetch('/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceKbId, sourcePath, targetKbId, targetPath }),
      })
      if (!res.ok) throw new Error('复制失败')
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
      const res = await sidecarFetch(`/knowledge-bases/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error('重命名失败')
      const updated = (await res.json()) as KnowledgeBase
      const idx = knowledgeBases.value.findIndex((kb) => kb.id === id)
      if (idx !== -1) knowledgeBases.value[idx] = updated
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  async function updateKbIcon(id: string, icon: string) {
    error.value = null
    try {
      const res = await sidecarFetch(`/knowledge-bases/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ icon }),
      })
      if (!res.ok) throw new Error('更新图标失败')
      const updated = (await res.json()) as KnowledgeBase
      const idx = knowledgeBases.value.findIndex((kb) => kb.id === id)
      if (idx !== -1) knowledgeBases.value[idx] = updated
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  async function togglePin(id: string) {
    const kb = knowledgeBases.value.find((k) => k.id === id)
    if (!kb) return
    const newPinned = kb.is_pinned ? 0 : 1
    error.value = null
    try {
      const res = await sidecarFetch(`/knowledge-bases/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_pinned: newPinned }),
      })
      if (!res.ok) throw new Error('置顶失败')
      const updated = (await res.json()) as KnowledgeBase
      const idx = knowledgeBases.value.findIndex((k) => k.id === id)
      if (idx !== -1) knowledgeBases.value[idx] = updated
      knowledgeBases.value = [...knowledgeBases.value].sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return b.is_pinned - a.is_pinned
        if (a.is_pinned) return b.sort_order - a.sort_order
        return b.created_at - a.created_at
      })
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  async function createFolder(name: string) {
    if (!selectedKbId.value) return
    error.value = null
    try {
      const res = await sidecarFetch(`/knowledge-bases/${selectedKbId.value}/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, path: currentPath.value }),
      })
      if (!res.ok) throw new Error('创建文件夹失败')
      const data = (await res.json()) as { name: string }
      await loadFiles(currentPath.value)
      return data.name
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  async function renameFile(oldName: string, newName: string) {
    if (!selectedKbId.value) return
    error.value = null
    try {
      const relativePath = currentPath.value ? `${currentPath.value}/${oldName}` : oldName
      const res = await sidecarFetch(`/knowledge-bases/${selectedKbId.value}/files/${relativePath}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({ error: '重命名失败' }))) as { error: string }
        throw new Error(err.error)
      }
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
      const res = await sidecarFetch(`/knowledge-bases/${selectedKbId.value}/files/${relativePath}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('删除失败')
      await loadFiles(currentPath.value)
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
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
    loadKnowledgeBases,
    createKnowledgeBase,
    deleteKnowledgeBase,
    restoreKnowledgeBase,
    loadDeletedKnowledgeBases,
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
  }
})
