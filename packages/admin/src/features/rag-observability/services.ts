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

export async function fetchRagTasks(): Promise<RagTask[]> {
  try {
    const mod = await import('@/utils/server')
    const data = await mod.alovaInstance.Get<RagTask[]>('/admin/rag/tasks').send()
    return data
  } catch {
    return getMockData()
  }
}

function getMockData(): RagTask[] {
  const now = Date.now()
  return [
    { id: 't1', type: 'indexing', status: 'running', progress: 45, durationMs: 1200, createdAt: new Date(now - 60000).toISOString(), updatedAt: new Date().toISOString() },
    { id: 't2', type: 'query', status: 'succeeded', progress: 100, durationMs: 320, createdAt: new Date(now - 120000).toISOString(), updatedAt: new Date(now - 119000).toISOString() },
    { id: 't3', type: 'chunking', status: 'failed', progress: 30, durationMs: 800, error: '文档解析失败', createdAt: new Date(now - 180000).toISOString(), updatedAt: new Date(now - 179000).toISOString() },
    { id: 't4', type: 'indexing', status: 'pending', progress: 0, durationMs: 0, createdAt: new Date(now - 300000).toISOString(), updatedAt: new Date(now - 300000).toISOString() },
    { id: 't5', type: 'query', status: 'succeeded', progress: 100, durationMs: 150, createdAt: new Date(now - 360000).toISOString(), updatedAt: new Date(now - 359800).toISOString() },
  ]
}
