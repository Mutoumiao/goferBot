import { alovaInstance } from '@/utils/server'
import type { AppConfig } from '@/utils/llm-config'

export const getSettings = () =>
  alovaInstance.Get<AppConfig>('/settings')

export const saveSettings = (data: AppConfig) =>
  alovaInstance.Post<AppConfig>('/settings', data)
