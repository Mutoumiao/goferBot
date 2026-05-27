import { describe, it, expect } from 'vitest'
import { RecursiveCharacterChunker } from '../../../packages/rag-sdk/src/chunkers/recursive-character.chunker.js'
import { ValidationError } from '../../../packages/rag-sdk/src/errors.js'

describe('RecursiveCharacterChunker', () => {
  it('AC-01: returns empty array for empty document content', async () => {
    const chunker = new RecursiveCharacterChunker()
    const result = await chunker.chunk({
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      kbId: '550e8400-e29b-41d4-a716-446655440001',
      content: '',
      mimeType: 'text/plain',
    })
    expect(result).toEqual([])
  })

  it('AC-01: splits long text into multiple chunks with correct chunkIndex', async () => {
    const chunker = new RecursiveCharacterChunker({ chunkSize: 10, chunkOverlap: 2 })
    const content = 'a'.repeat(100)
    const result = await chunker.chunk({
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      kbId: '550e8400-e29b-41d4-a716-446655440001',
      content,
      mimeType: 'text/plain',
    })
    expect(result.length).toBeGreaterThan(1)
    expect(result[0].chunkIndex).toBe(0)
    expect(result[1].chunkIndex).toBe(1)
    expect(result[0].documentId).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(result[0].kbId).toBe('550e8400-e29b-41d4-a716-446655440001')
    expect(result[0].tokenCount).toBe(Math.ceil(result[0].content.length / 4))
    expect(result[0].metadata).toEqual({ mimeType: 'text/plain' })
  })

  it('AC-01: throws ValidationError when chunkOverlap >= chunkSize', () => {
    expect(() => new RecursiveCharacterChunker({ chunkSize: 10, chunkOverlap: 10 }))
      .toThrow(ValidationError)
  })

  it('AC-01: throws ValidationError when chunkSize <= 0', () => {
    expect(() => new RecursiveCharacterChunker({ chunkSize: 0, chunkOverlap: 0 }))
      .toThrow(ValidationError)
  })
})
