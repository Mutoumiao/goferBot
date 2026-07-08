import type {
  CategorySettingsMap,
  FetchedModel,
  ModelProvider,
  ProviderPreset,
  SettingCategory,
  Settings,
} from '@goferbot/data'
import { alovaInstance } from '@/utils/server'

export type {
  AppearanceSettings,
  CategorySettingsMap,
  ChatSettings,
  CompanionSettings,
  FetchedModel,
  IndexingSettings,
  Model,
  ModelProvider,
  ProviderPreset,
  ProviderType,
  RagSettings,
  SettingCategory,
  Settings,
} from '@goferbot/data'

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
  presetKey: string
  baseUrl: string
  apiKey: string
}) => alovaInstance.Post<{ models: FetchedModel[] }>('/admin/providers/fetch-models', data)

export const getSystemConfig = () => alovaInstance.Get<Settings>('/admin/system-config')

export const getSystemCategory = <T extends SettingCategory>(category: T) =>
  alovaInstance.Get<CategorySettingsMap[T]>(`/admin/system-config/${category}`)

export const saveSystemCategory = <T extends SettingCategory>(
  category: T,
  data: CategorySettingsMap[T],
) => alovaInstance.Post<Settings>(`/admin/system-config/${category}`, data)

export const reloadSystemConfig = () =>
  alovaInstance.Post<{ success: boolean }>('/admin/system-config/reload')
