import { alovaInstance } from '@/utils/server'

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

export const fetchModels = () =>
  alovaInstance.Get<ModelConfig[]>('/admin/models')

export const createModel = (data: {
  provider: string
  model: string
  endpoint: string
  apiKey: string
}) => alovaInstance.Post<ModelConfig>('/admin/models', data)

export const updateModel = (
  id: string,
  data: { model?: string; endpoint?: string; apiKey?: string; isActive?: boolean },
) => alovaInstance.Patch<ModelConfig>(`/admin/models/${id}`, data)

export const deleteModel = (id: string) =>
  alovaInstance.Delete<{ success: boolean }>(`/admin/models/${id}`)

export const testConnection = (id: string) =>
  alovaInstance.Post<{ success: boolean; message?: string; latencyMs?: number }>(
    `/admin/models/${id}/test`,
  )
