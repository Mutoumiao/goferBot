import { describe, expect, it } from 'vitest'
import { buildAuthHeader, clearTokens, getAccessToken, setAccessToken } from '@/utils/auth-token'

describe('auth-token (admin namespace)', () => {
  it('uses admin-specific keys', () => {
    setAccessToken('t-1')
    expect(getAccessToken()).toBe('t-1')
    expect(buildAuthHeader()).toBe('Bearer t-1')
    expect(localStorage.getItem('goferbot_admin_access_token')).toBe('t-1')
    // 与 web 不冲突
    expect(localStorage.getItem('goferbot_access_token')).toBeNull()
  })

  it('clearTokens clears both keys', () => {
    setAccessToken('t-1')
    localStorage.setItem('goferbot_admin_refresh_token', 'r-1')
    clearTokens()
    expect(getAccessToken()).toBeNull()
    expect(localStorage.getItem('goferbot_admin_refresh_token')).toBeNull()
  })
})
