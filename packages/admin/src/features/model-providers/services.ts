import { toast } from 'sonner'
import type { FetchedModel, Model, ModelProvider, ProviderPreset } from '@/api/system-config'
import {
  deleteProvider,
  fetchProviderPresets,
  fetchRemoteModels,
  getProvider,
  listProviders,
  saveProvider,
} from '@/api/system-config'
import { mapErrorMessage } from '@/utils/error-mapper'

export type { FetchedModel, Model, ModelProvider, ProviderPreset }

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
  presetKey: string
  baseUrl: string
  apiKey: string
}): Promise<FetchedModel[]> {
  const res = await fetchRemoteModels(params).send()
  return res.models ?? []
}
