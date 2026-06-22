import { alovaInstance } from '@/utils/server'

export interface RagTask {
  id: string
  type: 'indexing' | 'query' | 'chunking'
  status: 'pending' | 'running' | 'succeeded' | 'failed'
  progress: number
  durationMs: number
  error?: string
  createdAt: string
  updatedAt: string
  documentId?: string
}

export const listRagTasks = () =>
  alovaInstance.Get<RagTask[]>('/admin/rag/tasks')

export const getRagTask = (id: string) =>
  alovaInstance.Get<RagTask>(`/admin/rag/tasks/${id}`)
