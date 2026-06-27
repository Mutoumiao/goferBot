import { toast } from 'sonner'
import type { ModelProvider } from '@/api/system-config'
import { deleteProvider, getProvider, listProviders, saveProvider } from '@/api/system-config'
import { mapErrorMessage } from '@/utils/error-mapper'

export type { ModelProvider }

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
