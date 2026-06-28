import { describe, expect, it } from 'vitest'
import { validatePassword } from '@/auth/dto/password.schema.js'

describe('validatePassword', () => {
  it('AC-06a: accepts password with letters and digits within range', () => {
    expect(() => validatePassword('abc123')).not.toThrow()
  })

  it('AC-06b: rejects password shorter than 6 chars', () => {
    expect(() => validatePassword('a1')).toThrow('密码长度需在 6-72 个字符之间')
  })

  it('AC-06c: rejects password longer than 72 chars', () => {
    expect(() => validatePassword('a'.repeat(73) + '1')).toThrow('密码长度需在 6-72 个字符之间')
  })

  it('AC-06d: rejects password without digits', () => {
    expect(() => validatePassword('abcdef')).toThrow('密码需同时包含字母和数字')
  })

  it('AC-06e: rejects password without letters', () => {
    expect(() => validatePassword('123456')).toThrow('密码需同时包含字母和数字')
  })

  it('AC-06f: accepts exactly 72 chars', () => {
    expect(() => validatePassword('a'.repeat(71) + '1')).not.toThrow()
  })
})
