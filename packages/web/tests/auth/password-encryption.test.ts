import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSend = vi.fn()

vi.mock('@/api/auth', () => ({
  getPublicKey: vi.fn(() => ({ send: mockSend })),
}))

import { getPublicKey } from '@/api/auth'
import {
  clearPublicKeyCache,
  encryptPassword,
  fetchPublicKey,
  PasswordEncryptionError,
} from '@/utils/password-encryption'

// Valid base64 string that atob can parse (16 bytes = 24 base64 chars after padding)
const VALID_BASE64_KEY = btoa('a'.repeat(16))

describe('password-encryption', () => {
  beforeEach(() => {
    clearPublicKeyCache()
    vi.clearAllMocks()
  })

  describe('fetchPublicKey', () => {
    it('fetches and caches public key', async () => {
      const mockKey = { type: 'public' } as unknown as CryptoKey
      mockSend.mockResolvedValue({
        publicKey: VALID_BASE64_KEY,
        algorithm: 'RSA-OAEP',
        hash: 'SHA-256',
      })

      vi.spyOn(crypto.subtle, 'importKey').mockResolvedValue(mockKey)

      const key1 = await fetchPublicKey()
      const key2 = await fetchPublicKey()

      expect(getPublicKey).toHaveBeenCalledTimes(1)
      expect(key1).toBe(mockKey)
      expect(key2).toBe(mockKey)

      vi.restoreAllMocks()
    })

    it('throws PasswordEncryptionError on fetch failure', async () => {
      mockSend.mockRejectedValue(new Error('network error'))

      await expect(fetchPublicKey()).rejects.toThrow(PasswordEncryptionError)
      await expect(fetchPublicKey()).rejects.toThrow('密码加密失败，请刷新页面后重试')
    })
  })

  describe('encryptPassword', () => {
    it('returns encrypted string for valid password', async () => {
      const mockKey = { type: 'public' } as unknown as CryptoKey
      mockSend.mockResolvedValue({
        publicKey: VALID_BASE64_KEY,
        algorithm: 'RSA-OAEP',
        hash: 'SHA-256',
      })

      vi.spyOn(crypto.subtle, 'importKey').mockResolvedValue(mockKey)
      vi.spyOn(crypto.subtle, 'encrypt').mockResolvedValue(new ArrayBuffer(16))

      const encrypted = await encryptPassword('my-password-123')

      expect(typeof encrypted).toBe('string')

      vi.restoreAllMocks()
    })

    it('throws PasswordEncryptionError when public key fetch fails', async () => {
      mockSend.mockRejectedValue(new Error('network error'))

      await expect(encryptPassword('password')).rejects.toThrow(PasswordEncryptionError)
      await expect(encryptPassword('password')).rejects.toThrow('密码加密失败，请刷新页面后重试')
    })
  })

  describe('clearPublicKeyCache', () => {
    it('clears cached key so next fetch hits API again', async () => {
      const mockKey = { type: 'public' } as unknown as CryptoKey
      mockSend.mockResolvedValue({
        publicKey: VALID_BASE64_KEY,
        algorithm: 'RSA-OAEP',
        hash: 'SHA-256',
      })

      vi.spyOn(crypto.subtle, 'importKey').mockResolvedValue(mockKey)

      await fetchPublicKey()
      clearPublicKeyCache()
      await fetchPublicKey()

      expect(getPublicKey).toHaveBeenCalledTimes(2)

      vi.restoreAllMocks()
    })
  })
})
