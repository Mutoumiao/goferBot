export interface ProviderFormData {
  name: string
  baseUrl: string
  apiKey: string
  model: string
}

export const DEFAULT_PROVIDER_FORM: ProviderFormData = {
  name: '',
  baseUrl: '',
  apiKey: '',
  model: '',
}

export function isCustomProviderKey(key: string): boolean {
  return key.startsWith('custom_')
}

export function generateCustomProviderKey(): string {
  return `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}
