export interface ModelConfig {
  id: string
  provider: string
  model: string
  endpoint: string
  apiKeyMasked: string
  isActive: boolean
  isBuiltIn?: boolean
  createdAt: string
  updatedAt: string
}

export async function fetchModels(): Promise<ModelConfig[]> {
  try {
    const mod = await import('@/utils/server')
    return await mod.alovaInstance.Get<ModelConfig[]>('/admin/models').send()
  } catch {
    return getMockData()
  }
}

export async function createModel(data: {
  provider: string
  model: string
  endpoint: string
  apiKey: string
}): Promise<ModelConfig> {
  const mod = await import('@/utils/server')
  return await mod.alovaInstance.Post<ModelConfig>('/admin/models', data).send()
}

export async function updateModel(
  id: string,
  data: { model?: string; endpoint?: string; apiKey?: string; isActive?: boolean },
): Promise<ModelConfig> {
  const mod = await import('@/utils/server')
  return await mod.alovaInstance.Patch<ModelConfig>(`/admin/models/${id}`, data).send()
}

export async function deleteModel(id: string): Promise<{ success: boolean }> {
  const mod = await import('@/utils/server')
  return await mod.alovaInstance.Delete<{ success: boolean }>(`/admin/models/${id}`).send()
}

export async function testConnection(id: string): Promise<{ success: boolean; message?: string; latencyMs?: number }> {
  const mod = await import('@/utils/server')
  return await mod.alovaInstance.Post<{ success: boolean; message?: string; latencyMs?: number }>(`/admin/models/${id}/test`).send()
}

function getMockData(): ModelConfig[] {
  return [
    { id: 'm1', provider: 'DeepSeek', model: 'deepseek-chat', endpoint: 'https://api.deepseek.com/v1', apiKeyMasked: 'sk-****xxxxxxxx', isActive: true, isBuiltIn: true, createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date().toISOString() },
    { id: 'm2', provider: 'OpenAI', model: 'gpt-4o', endpoint: 'https://api.openai.com/v1', apiKeyMasked: 'sk-****xxxxxxxx', isActive: true, isBuiltIn: true, createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date().toISOString() },
    { id: 'm3', provider: 'SiliconFlow', model: 'glm-4', endpoint: 'https://api.siliconflow.cn/v1', apiKeyMasked: 'sk-****xxxxxxxx', isActive: false, isBuiltIn: false, createdAt: new Date(Date.now() - 172800000).toISOString(), updatedAt: new Date().toISOString() },
  ]
}
