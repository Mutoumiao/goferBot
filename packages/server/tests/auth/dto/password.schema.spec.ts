import { describe, expect, it } from 'vitest'
import { validatePassword } from '@/auth/dto/password.schema.js'

describe('validatePassword', () => {
  it('AC-06a: accepts password with mixed case letters and digits within range', () => {
    expect(() => validatePassword('Abcdefg1')).not.toThrow()
  })

  it('AC-06b: rejects password shorter than 8 chars', () => {
    expect(() => validatePassword('A1')).toThrow('密码长度需在 8-72 个字符之间')
  })

  it('AC-06c: rejects password longer than 72 chars', () => {
    // ponytail: 73 字符的超长密码必须超过长度限制；混合大小写+数字
    const longPwd = `${'A'.repeat(37)}${'b'.repeat(35)}1` // 37+35+1 = 73
    expect(() => validatePassword(longPwd)).toThrow('密码长度需在 8-72 个字符之间')
  })

  it('AC-06d: rejects password without digits', () => {
    expect(() => validatePassword('Abcdefgh')).toThrow('密码必须包含数字')
  })

  it('AC-06e: rejects password without mixed case', () => {
    expect(() => validatePassword('abcdefg1')).toThrow('密码必须同时包含大小写字母')
    expect(() => validatePassword('ABCDEFG1')).toThrow('密码必须同时包含大小写字母')
  })

  it('AC-06f: accepts exactly 72 chars', () => {
    // 72 字符 + 符合大小写+数字要求
    expect(() => validatePassword(`${'A'.repeat(35)}${'b'.repeat(36)}1`)).not.toThrow()
  })
})
