import { describe, it, expect, vi, beforeEach } from 'vitest'
import { login, register, getMe, refresh, getPublicKey } from '@/api/auth'

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

  it('login sends POST to /auth/login with encryptedPassword', async () => {
    const method = login({ email: 'a@b.com', encryptedPassword: 'enc-pwd' })
    expect(alovaInstance.Post).toHaveBeenCalledWith('/auth/login', { email: 'a@b.com', encryptedPassword: 'enc-pwd' })
    expect(method.send).toBeDefined()
  })

  it('register sends POST to /auth/register with encryptedPassword and name', async () => {
    const method = register({ email: 'a@b.com', encryptedPassword: 'enc-pwd', name: 'User' })
    expect(alovaInstance.Post).toHaveBeenCalledWith('/auth/register', { email: 'a@b.com', encryptedPassword: 'enc-pwd', name: 'User' })
    expect(method.send).toBeDefined()
  })

  it('getMe sends GET to /auth/me', async () => {
    const method = getMe()
    expect(alovaInstance.Get).toHaveBeenCalledWith('/auth/me')
    expect(method.send).toBeDefined()
  })

  it('refresh sends POST to /auth/refresh', async () => {
    const method = refresh()
    expect(alovaInstance.Post).toHaveBeenCalledWith('/auth/refresh')
    expect(method.send).toBeDefined()
  })

  it('getPublicKey sends GET to /auth/public-key', async () => {
    const method = getPublicKey()
    expect(alovaInstance.Get).toHaveBeenCalledWith('/auth/public-key')
    expect(method.send).toBeDefined()
  })
})
