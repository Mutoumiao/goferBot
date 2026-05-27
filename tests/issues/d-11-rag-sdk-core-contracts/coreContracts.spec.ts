import { describe, it, expect } from 'vitest'
import {
  DocumentSourceSchema, QuerySchema, ChunkSchema,
  ChunkWithScoreSchema, RetrievalCandidateSchema,
  EmbeddingConfigSchema, HybridSearchOptionsSchema,
} from '../../../packages/rag-sdk/src/schema.js'

describe('Schema validation', () => {
  it('AC-01: validates valid DocumentSource', () => {
    const result = DocumentSourceSchema.safeParse({
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      kbId: '550e8400-e29b-41d4-a716-446655440001',
      content: 'hello world',
      mimeType: 'text/plain',
    })
    expect(result.success).toBe(true)
  })

  it('AC-02: rejects empty content in DocumentSource', () => {
    const result = DocumentSourceSchema.safeParse({
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      kbId: '550e8400-e29b-41d4-a716-446655440001',
      content: '',
      mimeType: 'text/plain',
    })
    expect(result.success).toBe(false)
  })

  it('AC-03: rejects negative chunkIndex in Chunk', () => {
    const result = ChunkSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      documentId: '550e8400-e29b-41d4-a716-446655440001',
      kbId: '550e8400-e29b-41d4-a716-446655440002',
      content: 'hello',
      chunkIndex: -1,
    })
    expect(result.success).toBe(false)
  })

  it('AC-04: rejects invalid UUID format', () => {
    const result = DocumentSourceSchema.safeParse({
      documentId: 'not-a-uuid',
      kbId: '550e8400-e29b-41d4-a716-446655440001',
      content: 'hello',
      mimeType: 'text/plain',
    })
    expect(result.success).toBe(false)
  })
})
