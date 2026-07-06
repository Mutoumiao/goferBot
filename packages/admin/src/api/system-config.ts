import type {
  CategorySettingsMap,
  ModelProvider,
  ProviderType,
  SettingCategory,
  Settings,
} from '@goferbot/data'
import { alovaInstance } from '@/utils/server'

export type {
  AppearanceSettings,
  CategorySettingsMap,
  ChatSettings,
  CompanionSettings,
  IndexingSettings,
  Model,
  ModelProvider,
  ProviderType,
  RagSettings,
  SettingCategory,
  Settings,
} from '@goferbot/data'

/** 预设提供商模板 */
export interface ProviderPreset {
  key: string
  label: string
  name: string
  baseUrl: string
}

/** 远程获取的模型条目 */
export interface FetchedModel {
  name: string
  type: ProviderType
  dimensions?: number
  maxLength?: number
}

/** 远程获取模型列表的结果 */
export interface FetchModelsResult {
  success: boolean
  models: FetchedModel[]
  error?: string
}

export const listProviders = () =>
  alovaInstance.Get<Record<string, ModelProvider>>('/admin/providers')

export const getProvider = (id: string) =>
  alovaInstance.Get<ModelProvider>(`/admin/providers/${id}`)

export const saveProvider = (data: ModelProvider) =>
  alovaInstance.Post<ModelProvider>('/admin/providers', data)

export const deleteProvider = (id: string) =>
  alovaInstance.Delete<{ success: boolean }>(`/admin/providers/${id}`)

export const fetchProviderPresets = () =>
  alovaInstance.Get<ProviderPreset[]>('/admin/providers/presets')

export const fetchRemoteModels = (data: {
  baseUrl: string
  apiKey: string
  isCompleteUrl: boolean
}) => alovaInstance.Post<FetchModelsResult>('/admin/providers/fetch-models', data)

export const getSystemConfig = () => alovaInstance.Get<Settings>('/admin/system-config')

export const getSystemCategory = <T extends SettingCategory>(category: T) =>
  alovaInstance.Get<CategorySettingsMap[T]>(`/admin/system-config/${category}`)

export const saveSystemCategory = <T extends SettingCategory>(
  category: T,
  data: CategorySettingsMap[T],
) => alovaInstance.Post<Settings>(`/admin/system-config/${category}`, data)

export const reloadSystemConfig = () =>
  alovaInstance.Post<{ success: boolean }>('/admin/system-config/reload')
