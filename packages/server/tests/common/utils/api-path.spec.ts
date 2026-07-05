import { ConfigService } from '@nestjs/config'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import {
  buildApiPath,
  categorizePath,
  getApiPrefix,
  initializeApiPath,
  isAdminOnlyPath,
  isPublicPath,
  isWebOnlyPath,
} from '../../../src/common/utils/api-path.js'

describe('api-path', () => {
  beforeAll(() => {
    const configService = {
      get: vi.fn().mockReturnValue('api'),
    } as unknown as ConfigService
    initializeApiPath(configService)
  })

  describe('getApiPrefix', () => {
    it('should return api prefix', () => {
      expect(getApiPrefix()).toBe('api')
    })
  })

  describe('buildApiPath', () => {
    it('should build full path with api prefix', () => {
      expect(buildApiPath('chat')).toBe('/api/chat')
      expect(buildApiPath('/chat')).toBe('/api/chat')
      expect(buildApiPath('web/auth/login')).toBe('/api/web/auth/login')
      expect(buildApiPath('/admin/auth/login')).toBe('/api/admin/auth/login')
    })
  })

  describe('isPublicPath', () => {
    it('should return true for public auth paths', () => {
      expect(isPublicPath('/api/auth/public-key')).toBe(true)
      expect(isPublicPath('/api/auth/captcha')).toBe(true)
    })

    it('should return false for non-public paths', () => {
      expect(isPublicPath('/api/web/auth/login')).toBe(false)
      expect(isPublicPath('/api/admin/auth/login')).toBe(false)
      expect(isPublicPath('/api/chat/completions')).toBe(false)
      expect(isPublicPath('/api/session/list')).toBe(false)
    })
  })

  describe('isAdminOnlyPath', () => {
    it('should return true for admin paths', () => {
      expect(isAdminOnlyPath('/api/admin/auth/login')).toBe(true)
      expect(isAdminOnlyPath('/api/admin/users')).toBe(true)
      expect(isAdminOnlyPath('/api/admin/roles')).toBe(true)
    })

    it('should return false for non-admin paths', () => {
      expect(isAdminOnlyPath('/api/web/auth/login')).toBe(false)
      expect(isAdminOnlyPath('/api/auth/public-key')).toBe(false)
      expect(isAdminOnlyPath('/api/chat/completions')).toBe(false)
    })
  })

  describe('isWebOnlyPath', () => {
    it('should return true for web paths', () => {
      expect(isWebOnlyPath('/api/web/auth/login')).toBe(true)
      expect(isWebOnlyPath('/api/web/auth/register')).toBe(true)
      expect(isWebOnlyPath('/api/web/orders')).toBe(true)
    })

    it('should return false for non-web paths', () => {
      expect(isWebOnlyPath('/api/admin/auth/login')).toBe(false)
      expect(isWebOnlyPath('/api/auth/public-key')).toBe(false)
      expect(isWebOnlyPath('/api/chat/completions')).toBe(false)
    })
  })

  describe('categorizePath', () => {
    it('should categorize public paths', () => {
      expect(categorizePath('/api/auth/public-key')).toBe('public')
      expect(categorizePath('/api/auth/captcha')).toBe('public')
    })

    it('should categorize admin-only paths', () => {
      expect(categorizePath('/api/admin/auth/login')).toBe('admin-only')
      expect(categorizePath('/api/admin/users')).toBe('admin-only')
    })

    it('should categorize web-biz paths', () => {
      expect(categorizePath('/api/web/auth/login')).toBe('web-biz')
      expect(categorizePath('/api/web/auth/register')).toBe('web-biz')
    })

    it('should categorize common paths', () => {
      expect(categorizePath('/api/chat/completions')).toBe('common')
      expect(categorizePath('/api/session/list')).toBe('common')
      expect(categorizePath('/api/auth/me')).toBe('common')
    })
  })
})
