import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getMe, getPublicKey, login, logout, refresh, register } from '@/api/auth'

vi.mock('@/utils/server', () => ({
  alovaInstance: {
    Post: vi.fn((url: string, data: unknown) => ({
      url,
      data,
      send: vi.fn().mockResolvedValue({ success: true }),
    })),
    Get: vi.fn((url: string) => ({
      url,
      send: vi.fn().mockResolvedValue({ success: true }),
    })),
  },
}))

import { alovaInstance } from '@/utils/server'

describe('auth api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('login sends POST to /auth/web/login with encryptedPassword', async () => {
    const method = login({ email: 'a@b.com', encryptedPassword: 'enc-pwd' })
    expect(alovaInstance.Post).toHaveBeenCalledWith('/auth/web/login', {
      email: 'a@b.com',
      encryptedPassword: 'enc-pwd',
    })
    expect(method.send).toBeDefined()
  })

  it('logout sends POST to /auth/web/logout with refreshToken', async () => {
    const method = logout({ refreshToken: 'rt' })
    expect(alovaInstance.Post).toHaveBeenCalledWith('/auth/web/logout', {
      refreshToken: 'rt',
    })
    expect(method.send).toBeDefined()
  })

  it('register sends POST to /auth/register with encryptedPassword and name', async () => {
    const method = register({ email: 'a@b.com', encryptedPassword: 'enc-pwd', name: 'User' })
    expect(alovaInstance.Post).toHaveBeenCalledWith('/auth/register', {
      email: 'a@b.com',
      encryptedPassword: 'enc-pwd',
      name: 'User',
    })
    expect(method.send).toBeDefined()
  })

  it('getMe sends GET to /auth/me', async () => {
    const method = getMe()
    expect(alovaInstance.Get).toHaveBeenCalledWith('/auth/me')
    expect(method.send).toBeDefined()
  })

  it('refresh sends POST to /auth/web/refresh with refreshToken', async () => {
    const method = refresh({ refreshToken: 'rt' })
    expect(alovaInstance.Post).toHaveBeenCalledWith('/auth/web/refresh', {
      refreshToken: 'rt',
    })
    expect(method.send).toBeDefined()
  })

  it('getPublicKey sends GET to /auth/public-key', async () => {
    const method = getPublicKey()
    expect(alovaInstance.Get).toHaveBeenCalledWith('/auth/public-key')
    expect(method.send).toBeDefined()
  })
})
