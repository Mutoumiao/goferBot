import { describe, expect, it } from 'vitest'
import {
  normalizeAuthLandingPath,
  validateChatsSearch,
  validateKnowledgeBaseSearch,
} from '@/lib/route-search'

describe('validateChatsSearch', () => {
  it('ignores all search keys (selection is store-driven)', () => {
    expect(validateChatsSearch({ c: 'sess-1' })).toEqual({})
    expect(validateChatsSearch({})).toEqual({})
    expect(validateChatsSearch({ c: '' })).toEqual({})
    expect(validateChatsSearch({ c: '  abc  ' })).toEqual({})
  })
})

describe('validateKnowledgeBaseSearch', () => {
  it('ignores all search keys (selection is store-driven)', () => {
    expect(validateKnowledgeBaseSearch({ kb: 'kb-1' })).toEqual({})
    expect(validateKnowledgeBaseSearch({})).toEqual({})
    expect(validateKnowledgeBaseSearch({ kb: '' })).toEqual({})
  })
})

describe('normalizeAuthLandingPath', () => {
  it('defaults empty and root to /chats', () => {
    expect(normalizeAuthLandingPath(undefined)).toBe('/chats')
    expect(normalizeAuthLandingPath(null)).toBe('/chats')
    expect(normalizeAuthLandingPath('')).toBe('/chats')
    expect(normalizeAuthLandingPath('/')).toBe('/chats')
  })

  it('redirects legacy chat and history paths to /chats', () => {
    expect(normalizeAuthLandingPath('/chat')).toBe('/chats')
    expect(normalizeAuthLandingPath('/chat/tab-xyz')).toBe('/chats')
    expect(normalizeAuthLandingPath('/chat?x=1')).toBe('/chats')
    expect(normalizeAuthLandingPath('/history')).toBe('/chats')
    expect(normalizeAuthLandingPath('/history?page=1')).toBe('/chats')
  })

  it('strips legacy query on primary paths and preserves others', () => {
    expect(normalizeAuthLandingPath('/chats?c=s1')).toBe('/chats')
    expect(normalizeAuthLandingPath('/knowledgeBase?kb=k1')).toBe('/knowledgeBase')
    expect(normalizeAuthLandingPath('/settings')).toBe('/settings')
    expect(normalizeAuthLandingPath('/companions')).toBe('/companions')
  })

  it('maps deleted companion secondary paths to /companions', () => {
    expect(normalizeAuthLandingPath('/companions/new')).toBe('/companions')
    expect(normalizeAuthLandingPath('/companions/abc/care')).toBe('/companions')
  })
})
