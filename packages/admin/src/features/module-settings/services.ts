import { toast } from 'sonner'
import type { CategorySettingsMap, SettingCategory } from '@/api/system-config'
import { getSystemCategory, reloadSystemConfig, saveSystemCategory } from '@/api/system-config'
import { mapErrorMessage } from '@/utils/error-mapper'

export async function getCategoryConfig<T extends SettingCategory>(
  category: T,
): Promise<CategorySettingsMap[T] | null> {
  try {
    return await getSystemCategory(category).send()
  } catch {
    return null
  }
}

export async function saveCategoryConfig<T extends SettingCategory>(
  category: T,
  data: CategorySettingsMap[T],
): Promise<boolean> {
  try {
    await saveSystemCategory(category, data).send()
    toast.success('保存成功')
    return true
  } catch (err) {
    const msg = mapErrorMessage(err)
    toast.error(msg)
    return false
  }
}

export async function reloadConfig(): Promise<boolean> {
  try {
    await reloadSystemConfig().send()
    toast.success('配置已重载')
    return true
  } catch (err) {
    const msg = mapErrorMessage(err)
    toast.error(msg)
    return false
  }
}
