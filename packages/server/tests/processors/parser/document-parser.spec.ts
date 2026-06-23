import { describe, expect, it } from 'vitest'
import { DocumentParser } from '@/processors/parser/document.parser.js'

describe('DocumentParser', () => {
  const parser = new DocumentParser()

  it('AC-01: parses text/plain buffer to utf-8 string', async () => {
    const buffer = Buffer.from('Hello GoferBot')
    const result = await parser.parseText(buffer, 'text/plain')
    expect(result).toBe('Hello GoferBot')
  })

  it('AC-02: parses text/markdown buffer to utf-8 string', async () => {
    const buffer = Buffer.from('# Title\n\nContent')
    const result = await parser.parseText(buffer, 'text/markdown')
    expect(result).toBe('# Title\n\nContent')
  })

  it('AC-03: parses application/pdf mimeType via PdfParser (fallback)', async () => {
    const buffer = Buffer.from('%PDF-1.4 fake')
    // 没有 PDF 解析库时，PdfParser 会 fallback 到原始 buffer 解码，不抛错
    const result = await parser.parseText(buffer, 'application/pdf')
    expect(result).toContain('%PDF-1.4')
  })

  it('AC-04: falls back to utf-8 for unknown mimeType', async () => {
    const buffer = Buffer.from('unknown content')
    const result = await parser.parseText(buffer, 'application/octet-stream')
    expect(result).toBe('unknown content')
  })

  it('AC-05: rejects empty buffer via Zod validation', async () => {
    // ponytail: 空 buffer 不应由解析器处理，应由上游 Worker 过滤；
    // Zod 校验会拒绝 content 为空的 ParseResult。
    await expect(parser.parseText(Buffer.from(''), 'text/plain')).rejects.toThrow(/content/)
  })

  it('AC-06: parse() returns structured ParseResult with hierarchyPath', async () => {
    const buffer = Buffer.from('# Title\n\n## Section A\n\nBody')
    const result = await parser.parse({ buffer, mimeType: 'text/markdown' })
    expect(result.content).toContain('# Title')
    expect(result.title).toBe('Title')
    expect(result.hierarchyPath).toContain('Title')
    expect(result.sections.length).toBeGreaterThanOrEqual(1)
  })

  it('AC-07: parse() validates input via Zod (Buffer 与 filePath 至少一个)', async () => {
    // 只传 mimeType，不传 buffer/filePath → ZodError
    await expect(
      parser.parse({ mimeType: 'text/plain', buffer: undefined as unknown as Buffer }),
    ).rejects.toThrow(/buffer|filePath/)
  })
})
