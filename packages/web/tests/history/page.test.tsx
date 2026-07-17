import { describe, expect, it } from 'vitest'
import { normalizeAuthLandingPath, validateChatsSearch } from '@/lib/route-search'

/**
 * 独立 /history 页已合并进 /chats 左栏。
 * 选中态已迁 store，validateChatsSearch 忽略 search。
 */
describe('history page redirect contract', () => {
  it('validateChatsSearch ignores legacy c param', () => {
    expect(validateChatsSearch({ c: 'sess-1' })).toEqual({})
    expect(validateChatsSearch({})).toEqual({})
    expect(validateChatsSearch({ c: '' })).toEqual({})
  })

  it('normalizeAuthLandingPath strips legacy chats query', () => {
    expect(normalizeAuthLandingPath('/chats?c=s1')).toBe('/chats')
  })
})
