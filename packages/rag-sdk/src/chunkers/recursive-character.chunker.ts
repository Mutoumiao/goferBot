import type { DocumentSource, Chunk } from '../types.js'
import { ValidationError } from '../errors.js'

interface RecursiveCharacterChunkerOptions {
  chunkSize?: number
  chunkOverlap?: number
  separators?: string[]
}

export class RecursiveCharacterChunker {
  private readonly chunkSize: number
  private readonly chunkOverlap: number
  private readonly separators: string[]

  constructor(options?: RecursiveCharacterChunkerOptions) {
    const chunkSize = options?.chunkSize ?? 512
    const chunkOverlap = options?.chunkOverlap ?? 50

    if (chunkSize <= 0) {
      throw new ValidationError('chunkSize must be greater than 0')
    }
    if (chunkOverlap >= chunkSize) {
      throw new ValidationError('chunkOverlap must be less than chunkSize')
    }
    if (chunkOverlap < 0) {
      throw new ValidationError('chunkOverlap must be greater than or equal to 0')
    }

    this.chunkSize = chunkSize
    this.chunkOverlap = chunkOverlap
    this.separators = options?.separators ?? ['\n\n', '\n', ' ', '']
  }

  async chunk(doc: DocumentSource): Promise<Chunk[]> {
    if (doc.content.length === 0) {
      return []
    }

    const chunks: Chunk[] = []
    let remaining = doc.content
    let chunkIndex = 0

    while (remaining.length > 0) {
      let chunkText: string

      if (remaining.length <= this.chunkSize) {
        chunkText = remaining
        remaining = ''
      } else {
        chunkText = this.splitWithSeparators(remaining)
        // 如果按分隔符切出的块太小（<= overlap），直接按 chunkSize 切，避免无限循环
        if (chunkText.length <= this.chunkOverlap) {
          chunkText = remaining.slice(0, this.chunkSize)
        }
        const overlapStart = chunkText.length - this.chunkOverlap
        remaining = remaining.slice(overlapStart)
      }

      chunks.push({
        id: crypto.randomUUID(),
        documentId: doc.documentId,
        kbId: doc.kbId,
        content: chunkText,
        chunkIndex,
        tokenCount: Math.ceil(chunkText.length / 4),
        parentId: undefined,
        hierarchyPath: undefined,
        metadata: { mimeType: doc.mimeType },
      })

      chunkIndex++

      if (chunkText.length === 0) {
        remaining = remaining.slice(1)
      }
    }

    return chunks
  }

  private splitWithSeparators(text: string): string {
    for (const sep of this.separators) {
      if (sep === '') {
        return text.slice(0, this.chunkSize)
      }

      const idx = text.lastIndexOf(sep, this.chunkSize)
      if (idx > 0) {
        return text.slice(0, idx + sep.length)
      }
    }

    return text.slice(0, this.chunkSize)
  }
}
