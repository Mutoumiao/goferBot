import { Injectable } from '@nestjs/common'

@Injectable()
export class DocumentParser {
  async parse(buffer: Buffer, mimeType: string): Promise<string> {
    switch (mimeType) {
      case 'text/plain':
      case 'text/markdown':
      case 'text/x-markdown':
        return buffer.toString('utf-8')
      case 'application/pdf':
        throw new Error('PDF parsing not yet implemented')
      default:
        // 未知类型降级为 utf-8
        return buffer.toString('utf-8')
    }
  }
}
