import { describe, expect, it } from 'vitest'
import {
  categorizePath,
  isAdminOnlyPath,
} from '../../../src/common/utils/api-path.js'

describe('api-path', () => {
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
