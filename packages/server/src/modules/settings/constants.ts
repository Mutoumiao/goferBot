export const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000'
export const APP_CONFIG_KEY = 'app_config'
export const SYSTEM_CONFIG_KEY = 'system_config'

export const SETTING_CATEGORIES = ['chat', 'rag', 'companion', 'indexing', 'appearance'] as const

export type SettingCategory = (typeof SETTING_CATEGORIES)[number]

export const MODEL_PROVIDER_ERROR_CODES = {
  NOT_CONFIGURED: 'MODEL_PROVIDER_NOT_CONFIGURED',
  NOT_FOUND: 'MODEL_PROVIDER_NOT_FOUND',
  TYPE_MISMATCH: 'MODEL_PROVIDER_TYPE_MISMATCH',
  DISABLED: 'MODEL_PROVIDER_DISABLED',
  NOT_ENABLED: 'MODEL_PROVIDER_NOT_ENABLED',
  IN_USE: 'PROVIDER_IN_USE',
} as const

export class ConfigChangedEvent {
  constructor(
    public readonly category: SettingCategory | 'providers',
    public readonly isSystem: boolean,
  ) {}
}
