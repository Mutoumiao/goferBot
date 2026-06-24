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

    it('should store and retrieve access token', () => {
      setAccessToken(TEST_TOKEN)
      expect(getAccessToken()).toBe(TEST_TOKEN)
    })
  })

  describe('getRefreshToken / setRefreshToken', () => {
    it('should return null when no refresh token is stored', () => {
      expect(getRefreshToken()).toBeNull()
    })

    it('should store and retrieve refresh token', () => {
      setRefreshToken(TEST_REFRESH_TOKEN)
      expect(getRefreshToken()).toBe(TEST_REFRESH_TOKEN)
    })
  })

  describe('clearTokens', () => {
    it('should clear all tokens', () => {
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

    it('should return Bearer token header when token exists', () => {
      setAccessToken(TEST_TOKEN)
      expect(buildAuthHeader()).toBe(`Bearer ${TEST_TOKEN}`)
    })
  })
})
