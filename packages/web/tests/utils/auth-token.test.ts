import { afterEach, describe, expect, it } from 'vitest'
import {
  buildAuthHeader,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from '@/utils/auth-token'

describe('auth-token utils', () => {
  const TEST_TOKEN = 'test-access-token-12345'
  const TEST_REFRESH_TOKEN = 'test-refresh-token-67890'

  afterEach(() => {
    localStorage.clear()
  })

  describe('getAccessToken / setAccessToken', () => {
    it('should return null when no token is stored', () => {
      expect(getAccessToken()).toBeNull()
    })

    it('setAccessToken is a no-op (tokens moved to HttpOnly Cookie)', () => {
      setAccessToken(TEST_TOKEN)
      expect(getAccessToken()).toBeNull()
    })
  })

  describe('getRefreshToken / setRefreshToken', () => {
    it('should return null when no refresh token is stored', () => {
      expect(getRefreshToken()).toBeNull()
    })

    it('setRefreshToken is a no-op (tokens moved to HttpOnly Cookie)', () => {
      setRefreshToken(TEST_REFRESH_TOKEN)
      expect(getRefreshToken()).toBeNull()
    })
  })

  describe('clearTokens', () => {
    it('clearTokens is a no-op (tokens moved to HttpOnly Cookie)', () => {
      setAccessToken(TEST_TOKEN)
      setRefreshToken(TEST_REFRESH_TOKEN)
      clearTokens()
      expect(getAccessToken()).toBeNull()
      expect(getRefreshToken()).toBeNull()
    })
  })

  describe('buildAuthHeader', () => {
    it('should return null when no token is stored', () => {
      expect(buildAuthHeader()).toBeNull()
    })

    it('should return null even if access token was set (header no longer assembled client-side)', () => {
      setAccessToken(TEST_TOKEN)
      expect(buildAuthHeader()).toBeNull()
    })
  })
})
