import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/api/client'

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

export const useFileStore = defineStore('file', () => {
  const folders = ref<Folder[]>([])
  const documents = ref<DocumentItem[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const currentKbId = ref<string | null>(null)
  const currentFolderId = ref<string | null>(null)

  const breadcrumb = computed(() => {
    const path: Folder[] = []
    let fid = currentFolderId.value
    while (fid) {
      const f = folders.value.find((x) => x.id === fid)
      if (!f) break
      path.unshift(f)
      fid = f.parentId
    }
    return path
  })

  async function loadItems(kbId: string, folderId?: string | null) {
    currentKbId.value = kbId
    currentFolderId.value = folderId ?? null
    isLoading.value = true
    error.value = null
    try {
      const [fRes, dRes] = await Promise.all([
        api.get<Folder[]>(`/knowledge-bases/${kbId}/folders?parentId=${folderId ?? ''}`),
        api.get<DocumentItem[]>(`/knowledge-bases/${kbId}/documents?folderId=${folderId ?? ''}`),
      ])
      folders.value = fRes ?? []
      documents.value = dRes ?? []
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载失败'
    } finally {
      isLoading.value = false
    }
  }

  async function deleteDocument(docId: string) {
    if (!currentKbId.value) return
    await api.delete(`/knowledge-bases/${currentKbId.value}/documents/${docId}`)
    documents.value = documents.value.filter((d) => d.id !== docId)
  }

  async function renameDocument(docId: string, name: string) {
    if (!currentKbId.value) return
    const updated = await api.patch<DocumentItem>(`/knowledge-bases/${currentKbId.value}/documents/${docId}`, { name })
    const idx = documents.value.findIndex((d) => d.id === docId)
    if (idx !== -1) documents.value[idx] = updated
  }

  async function moveDocument(docId: string, targetFolderId: string | null) {
    if (!currentKbId.value) return
    await api.patch<DocumentItem>(`/knowledge-bases/${currentKbId.value}/documents/${docId}`, { folderId: targetFolderId })
    documents.value = documents.value.filter((d) => d.id !== docId)
  }

  return {
    folders, documents, isLoading, error,
    currentKbId, currentFolderId, breadcrumb,
    loadItems, deleteDocument, renameDocument, moveDocument,
  }
})
