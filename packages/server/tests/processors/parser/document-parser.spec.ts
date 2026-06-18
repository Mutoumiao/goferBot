import { describe, expect, it } from 'vitest'
import { DocumentParser } from '@/processors/parser/document.parser.js'

describe('DocumentParser', () => {
  const parser = new DocumentParser()

  it('AC-01: parses text/plain buffer to utf-8 string', async () => {
    const buffer = Buffer.from('Hello GoferBot')
    const result = await parser.parse(buffer, 'text/plain')
    expect(result).toBe('Hello GoferBot')
  })

  it('AC-02: parses text/markdown buffer to utf-8 string', async () => {
    const buffer = Buffer.from('# Title\n\nContent')
    const result = await parser.parse(buffer, 'text/markdown')
    expect(result).toBe('# Title\n\nContent')
  })

  it('AC-03: throws error for application/pdf mimeType', async () => {
    const buffer = Buffer.from('pdf-binary')
    await expect(parser.parse(buffer, 'application/pdf')).rejects.toThrow(
      'PDF parsing not yet implemented',
    )
  })

  it('AC-04: falls back to utf-8 for unknown mimeType', async () => {
    const buffer = Buffer.from('unknown content')
    const result = await parser.parse(buffer, 'application/octet-stream')
    expect(result).toBe('unknown content')
  })

  it('AC-05: returns empty string for empty buffer', async () => {
    const result = await parser.parse(Buffer.from(''), 'text/plain')
    expect(result).toBe('')
  })
})
