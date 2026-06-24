import { describe, expect, it } from 'vitest'
import { generateCustomProviderKey, isCustomProviderKey } from '@/features/settings/types'

describe('Settings Types', () => {
  describe('generateCustomProviderKey', () => {
    it('should generate a key starting with custom_', () => {
      const key = generateCustomProviderKey()
      expect(key).toMatch(/^custom_/)
    })

    it('should include timestamp', () => {
      const key = generateCustomProviderKey()
      const parts = key.split('_')
      expect(parts[1]).toBeDefined()
      expect(Number(parts[1])).toBeGreaterThan(0)
    })

    it('should include random suffix', () => {
      const key = generateCustomProviderKey()
      const parts = key.split('_')
      expect(parts[2]).toBeDefined()
      expect(parts[2].length).toBe(8)
    })

    it('should generate unique keys', () => {
      const keys = new Set<string>()
      for (let i = 0; i < 100; i++) {
        keys.add(generateCustomProviderKey())
      }
      expect(keys.size).toBe(100)
    })
  })

  describe('isCustomProviderKey', () => {
    it('should return true for custom provider keys', () => {
      expect(isCustomProviderKey('custom_123_test')).toBe(true)
      expect(isCustomProviderKey('custom_abc')).toBe(true)
    })

    it('should return false for non-custom provider keys', () => {
      expect(isCustomProviderKey('openai-gpt4')).toBe(false)
      expect(isCustomProviderKey('test')).toBe(false)
      expect(isCustomProviderKey('')).toBe(false)
    })
  })
})
