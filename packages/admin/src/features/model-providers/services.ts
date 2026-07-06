import { toast } from 'sonner'
import type { FetchModelsResult, Model, ModelProvider, ProviderPreset } from '@/api/system-config'
import {
  deleteProvider,
  fetchProviderPresets,
  fetchRemoteModels,
  getProvider,
  listProviders,
  saveProvider,
} from '@/api/system-config'
import { mapErrorMessage } from '@/utils/error-mapper'

export type { FetchModelsResult, Model, ModelProvider, ProviderPreset }

export async function getProviders(): Promise<Record<string, ModelProvider>> {
  return await listProviders().send()
}

export async function getProviderById(id: string): Promise<ModelProvider | null> {
  try {
    return await getProvider(id).send()
  } catch {
    return null
  }
}

export async function saveProviderService(data: ModelProvider): Promise<boolean> {
  try {
    await saveProvider(data).send()
    toast.success('保存成功')
    return true
  } catch (err) {
    const msg = mapErrorMessage(err)
    toast.error(msg)
    return false
  }
}

export async function deleteProviderService(id: string): Promise<boolean> {
  try {
    await deleteProvider(id).send()
    toast.success('删除成功')
    return true
  } catch (err) {
    const msg = mapErrorMessage(err)
    toast.error(msg)
    return false
  }
}

export async function fetchPresets(): Promise<ProviderPreset[]> {
  try {
    return await fetchProviderPresets().send()
  } catch {
    return []
  }
}

export async function fetchRemoteModelsService(params: {
  baseUrl: string
  apiKey: string
  isCompleteUrl: boolean
}): Promise<FetchModelsResult> {
  try {
    return await fetchRemoteModels(params).send()
  } catch (err) {
    return { success: false, models: [], error: mapErrorMessage(err) }
  }
}
