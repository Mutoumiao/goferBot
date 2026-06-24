import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface TestSettingsConfig {
  providers: Record<string, { name: string }>
  appearance: 'light' | 'dark' | 'system'
  fontSizeLevel: number
  defaultChatProvider: string
}

interface TestSettingsStore {
  config: TestSettingsConfig
  isLoading: boolean
  error: Error | null
  addCustomProvider: (key: string, data: { name: string }) => void
  updateCustomProvider: (key: string, data: Partial<{ name: string }>) => void
  removeCustomProvider: (key: string) => void
  setAppearance: (value: 'light' | 'dark' | 'system') => void
  setFontSizeLevel: (value: number) => void
  setDefaultChatProvider: (value: string) => void
  loadConfig: () => void
  saveConfig: () => void
}

const createTestStore = () =>
  create<TestSettingsStore>()(
    persist(
      (set) => ({
        config: {
          providers: {},
          appearance: 'system',
          fontSizeLevel: 3,
          defaultChatProvider: '',
        },
        isLoading: false,
        error: null,
        addCustomProvider: (key, data) =>
          set((s) => ({
            config: { ...s.config, providers: { ...s.config.providers, [key]: data } },
          })),
        updateCustomProvider: (key, data) =>
          set((s) => ({
            config: {
              ...s.config,
              providers: { ...s.config.providers, [key]: { ...s.config.providers[key], ...data } },
            },
          })),
        removeCustomProvider: (key) =>
          set((s) => {
            const newProviders = { ...s.config.providers }
            delete newProviders[key]
            return { config: { ...s.config, providers: newProviders } }
          }),
        setAppearance: (value) => set((s) => ({ config: { ...s.config, appearance: value } })),
        setFontSizeLevel: (value) => set((s) => ({ config: { ...s.config, fontSizeLevel: value } })),
        setDefaultChatProvider: (value) =>
          set((s) => ({ config: { ...s.config, defaultChatProvider: value } })),
        loadConfig: () => {},
        saveConfig: () => {},
      }),
      { name: 'test-settings' },
    ),
  )

describe('Settings Services', () => {
  let store: ReturnType<typeof createTestStore>

  beforeEach(() => {
    store = createTestStore()
  })

  afterEach(() => {})

  describe('Provider Management', () => {
    it('should add a custom provider', () => {
      store.getState().addCustomProvider('test-1', { name: 'Test Provider' })
      expect(store.getState().config.providers['test-1']).toEqual({ name: 'Test Provider' })
    })

    it('should update a custom provider', () => {
      store.getState().addCustomProvider('test-1', { name: 'Original' })
      store.getState().updateCustomProvider('test-1', { name: 'Updated' })
      expect(store.getState().config.providers['test-1']).toEqual({ name: 'Updated' })
    })

    it('should remove a custom provider', () => {
      store.getState().addCustomProvider('test-1', { name: 'Test' })
      expect(store.getState().config.providers['test-1']).toBeDefined()
      store.getState().removeCustomProvider('test-1')
      expect(store.getState().config.providers['test-1']).toBeUndefined()
    })
  })

  describe('Appearance Settings', () => {
    it('should set appearance to light', () => {
      store.getState().setAppearance('light')
      expect(store.getState().config.appearance).toBe('light')
    })

    it('should set appearance to dark', () => {
      store.getState().setAppearance('dark')
      expect(store.getState().config.appearance).toBe('dark')
    })

    it('should set appearance to system', () => {
      store.getState().setAppearance('system')
      expect(store.getState().config.appearance).toBe('system')
    })
  })

  describe('Font Size Settings', () => {
    it('should set valid font size levels', () => {
      const validLevels = [1, 2, 3, 4, 5]
      for (const level of validLevels) {
        store.getState().setFontSizeLevel(level)
        expect(store.getState().config.fontSizeLevel).toBe(level)
      }
    })
  })

  describe('Default Provider', () => {
    it('should set default chat provider', () => {
      store.getState().setDefaultChatProvider('openai-gpt4')
      expect(store.getState().config.defaultChatProvider).toBe('openai-gpt4')
    })
  })
})
