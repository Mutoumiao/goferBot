import { describe, expect, it } from 'vitest'
import { buildAuthHeader, clearTokens, getAccessToken, setAccessToken } from '@/utils/auth-token'

describe('auth-token (admin namespace)', () => {
  it('setAccessToken is a no-op (tokens moved to HttpOnly Cookie)', () => {
    setAccessToken('t-1')
    expect(getAccessToken()).toBeNull()
    expect(buildAuthHeader()).toBeNull()
    expect(localStorage.getItem('goferbot_admin_access_token')).toBeNull()
    expect(localStorage.getItem('goferbot_access_token')).toBeNull()
  })

  it('clearTokens is a no-op (tokens moved to HttpOnly Cookie)', () => {
    setAccessToken('t-1')
    localStorage.setItem('goferbot_admin_refresh_token', 'r-1')
    clearTokens()
    expect(getAccessToken()).toBeNull()
    expect(localStorage.getItem('goferbot_admin_refresh_token')).toBe('r-1')
  })
})
