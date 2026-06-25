import { toast } from 'sonner'
import {
  createModel as createModelApi,
  deleteModel as deleteModelApi,
  fetchModels as fetchModelsApi,
  testConnection as testConnectionApi,
  updateModel as updateModelApi,
} from '@/api/model'
import type { ModelConfig } from '@/api/model'
import { mapErrorMessage } from '@/utils/error-mapper'

export type { ModelConfig }

export async function getModels(): Promise<ModelConfig[]> {
  try {
    return await fetchModelsApi().send()
  } catch {
    return getMockData()
  }
}

export async function createModelService(data: {
  provider: string
  model: string
  endpoint: string
  apiKey: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    await createModelApi(data).send()
    toast.success('创建模型成功')
    return { success: true }
  } catch (err) {
    const msg = mapErrorMessage(err)
    toast.error(msg)
    return { success: false, error: msg }
  }
}

export async function updateModelService(
  id: string,
  data: { model?: string; endpoint?: string; apiKey?: string; isActive?: boolean },
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateModelApi(id, data).send()
    toast.success('更新模型成功')
    return { success: true }
  } catch (err) {
    const msg = mapErrorMessage(err)
    toast.error(msg)
    return { success: false, error: msg }
  }
}

export async function deleteModelService(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteModelApi(id).send()
    toast.success('模型已删除')
    return { success: true }
  } catch (err) {
    const msg = mapErrorMessage(err)
    toast.error(msg)
    return { success: false, error: msg }
  }
}

export async function testModelConnection(
  id: string,
): Promise<{ success: boolean; message?: string; latencyMs?: number }> {
  try {
    const result = await testConnectionApi(id).send()
    if (result.success) {
      toast.success(`连接成功，耗时 ${result.latencyMs ?? 0}ms`)
    }
    return result
  } catch (err) {
    const msg = mapErrorMessage(err)
    toast.error(msg)
    return { success: false, message: msg }
  }
}

function getMockData(): ModelConfig[] {
  return [
    {
      id: 'm1',
      provider: 'DeepSeek',
      model: 'deepseek-chat',
      endpoint: 'https://api.deepseek.com/v1',
      apiKeyMasked: 'sk-****xxxxxxxx',
      isActive: true,
      isBuiltIn: true,
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'm2',
      provider: 'OpenAI',
      model: 'gpt-4o',
      endpoint: 'https://api.openai.com/v1',
      apiKeyMasked: 'sk-****xxxxxxxx',
      isActive: true,
      isBuiltIn: true,
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'm3',
      provider: 'SiliconFlow',
      model: 'glm-4',
      endpoint: 'https://api.siliconflow.cn/v1',
      apiKeyMasked: 'sk-****xxxxxxxx',
      isActive: false,
      isBuiltIn: false,
      createdAt: new Date(Date.now() - 172800000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]
}
