import { describe, expect, it } from 'vitest'
import {
  partitionUploadFiles,
  validateUploadFile,
} from '@/features/KnowledgeBase/upload-validation'

function makeFile(name: string, size = 100, type = 'application/pdf') {
  const content = new Uint8Array(Math.min(size, 16))
  const file = new File([content], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

describe('validateUploadFile', () => {
  it('accepts allowed extensions even with empty MIME', () => {
    const file = makeFile('notes.md', 100, '')
    expect(validateUploadFile(file)).toEqual({ valid: true })
  })

  it('rejects unsupported extension', () => {
    const result = validateUploadFile(makeFile('a.exe'))
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('不支持')
      expect(result.code).toBe('type')
    }
  })

  it('rejects oversize files', () => {
    const result = validateUploadFile(makeFile('big.pdf', 51 * 1024 * 1024))
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('50MB')
      expect(result.code).toBe('oversize')
    }
  })

  it('rejects illegal filename characters', () => {
    const result = validateUploadFile(makeFile('../evil.pdf'))
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('非法')
      expect(result.code).toBe('name')
    }
  })
})

describe('partitionUploadFiles', () => {
  it('splits valid and rejected with codes', () => {
    const { valid, rejected } = partitionUploadFiles([
      makeFile('ok.pdf'),
      makeFile('bad.exe'),
      makeFile('ok2.md', 10, ''),
    ])
    expect(valid.map((f) => f.name)).toEqual(['ok.pdf', 'ok2.md'])
    expect(rejected).toHaveLength(1)
    expect(rejected[0].name).toBe('bad.exe')
    expect(rejected[0].code).toBe('type')
  })
})
