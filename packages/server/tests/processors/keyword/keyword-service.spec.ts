import { beforeEach, describe, expect, it, vi } from 'vitest'
import { KeywordModule } from '@/processors/keyword/keyword.module.js'
import { KeywordService } from '@/processors/keyword/keyword.service.js'

describe('KeywordService', () => {
  let keywordService: KeywordService
  let mockPrisma: any

  beforeEach(() => {
    mockPrisma = {
      $queryRaw: vi.fn().mockResolvedValue([]),
    }
    keywordService = new KeywordService(mockPrisma)
  })

  it('AC-03: search returns RetrievalCandidate[] ordered by rank desc', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      { id: 'c1', document_id: 'd1', kb_id: 'kb-1', content: 'hello', chunk_index: 0, rank: 0.9 },
      { id: 'c2', document_id: 'd2', kb_id: 'kb-1', content: 'world', chunk_index: 0, rank: 0.5 },
    ])
    const result = await keywordService.search('test', ['kb-1'], 5)
    expect(Array.isArray(result)).toBe(true)
    result.forEach((r: any, i: number) => {
      if (i > 0) expect(r.score).toBeLessThanOrEqual(result[i - 1].score)
      expect(r.source).toBe('keyword')
      expect(r.chunk).toHaveProperty('id')
      expect(r.chunk).toHaveProperty('content')
    })
  })

  it('AC-04: search filters by kbIds', async () => {
    await keywordService.search('hello', ['kb-a', 'kb-b'], 3)
    const callArgs = mockPrisma.$queryRaw.mock.calls[0]
    // Prisma $queryRaw receives a template string array as first arg
    const templateStrings = callArgs[0] as any
    const sqlText = Array.isArray(templateStrings)
      ? templateStrings.join('?')
      : String(templateStrings)
    expect(sqlText).toContain('kb_id = ANY')
  })

  it('AC-05: search returns empty array for empty query', async () => {
    const result = await keywordService.search('', ['kb-1'])
    expect(result).toEqual([])
  })

  it('AC-06: search returns empty array for empty kbIds', async () => {
    const result = await keywordService.search('hello', [])
    expect(result).toEqual([])
  })

  it('AC-07: falls back to simple config when zhparser is not installed', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([])
    await keywordService.onModuleInit()
    expect((keywordService as any).useChineseConfig).toBe(false)
    expect((keywordService as any).configChecked).toBe(true)
  })
})

describe('KeywordModule', () => {
  it('AC-09: KeywordModule is a global module with KeywordService provider', () => {
    expect(KeywordModule).toBeDefined()
    const moduleMeta = Reflect.getMetadata('providers', KeywordModule)
    expect(moduleMeta).toContain(KeywordService)
  })
})
