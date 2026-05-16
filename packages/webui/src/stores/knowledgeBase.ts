import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/api/client'

export interface KnowledgeBase {
  id: string
  name: string
  description: string | null
  icon: string | null
  isPinned: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export const useKnowledgeBaseStore = defineStore('knowledgeBase', () => {
  const knowledgeBases = ref<KnowledgeBase[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function loadKnowledgeBases() {
    isLoading.value = true
    error.value = null
    try {
      const data = await api.get<KnowledgeBase[]>('/knowledge-bases')
      knowledgeBases.value = data ?? []
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载知识库失败'
    } finally {
      isLoading.value = false
    }
  }

  async function createKnowledgeBase(name: string, description?: string) {
    error.value = null
    try {
      const kb = await api.post<KnowledgeBase>('/knowledge-bases', {
        name,
        description,
      })
      knowledgeBases.value.unshift(kb)
      return kb
    } catch (e) {
      error.value = e instanceof Error ? e.message : '创建知识库失败'
      throw e
    }
  }

  async function renameKnowledgeBase(id: string, name: string) {
    error.value = null
    try {
      const updated = await api.patch<KnowledgeBase>(`/knowledge-bases/${id}`, { name })
      const idx = knowledgeBases.value.findIndex((kb) => kb.id === id)
      if (idx !== -1) {
        knowledgeBases.value[idx] = updated
      }
      return updated
    } catch (e) {
      error.value = e instanceof Error ? e.message : '重命名失败'
      throw e
    }
  }

  async function deleteKnowledgeBase(id: string) {
    error.value = null
    try {
      await api.delete(`/knowledge-bases/${id}`)
      knowledgeBases.value = knowledgeBases.value.filter((kb) => kb.id !== id)
    } catch (e) {
      error.value = e instanceof Error ? e.message : '删除知识库失败'
      throw e
    }
  }

  async function togglePin(id: string) {
    const kb = knowledgeBases.value.find((k) => k.id === id)
    if (!kb) return
    const nextPinned = !kb.isPinned
    try {
      const updated = await api.patch<KnowledgeBase>(`/knowledge-bases/${id}`, {
        isPinned: nextPinned,
      })
      const idx = knowledgeBases.value.findIndex((k) => k.id === id)
      if (idx !== -1) {
        knowledgeBases.value[idx] = updated
      }
      // Re-sort: pinned first, then by sortOrder, then by createdAt desc
      knowledgeBases.value = [...knowledgeBases.value].sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
    } catch (e) {
      error.value = e instanceof Error ? e.message : '操作失败'
      throw e
    }
  }

  return {
    knowledgeBases,
    isLoading,
    error,
    loadKnowledgeBases,
    createKnowledgeBase,
    renameKnowledgeBase,
    deleteKnowledgeBase,
    togglePin,
  }
})
