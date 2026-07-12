/**
 * PDF 解析器
 *
 *   设计原则：
 *     1) 优先使用 pdf-parse（动态 require，非硬依赖）
 *     2) 未安装时降级为 Buffer 原始字符串提取
 *     3) 对外接口稳定；RAG 索引链路在 Knowledge AI，不依赖 LlamaIndex
 *
 * 使用：
 *   ```ts
 *   const parser = new PdfParser()
 *   const result = await parser.parse({ buffer, mimeType: 'application/pdf' })
 *   ```
 */
import { Logger } from '@nestjs/common'
import type { IDocumentParser, ParseResult, ParserInput } from './parser.types.js'
import { StructureExtractor } from './structure-extractor.js'

export class PdfParser implements IDocumentParser {
  readonly name = 'pdf'
  readonly mimeTypes = ['application/pdf']
  private readonly logger = new Logger(PdfParser.name)

  constructor(private readonly extractor: StructureExtractor = new StructureExtractor()) {}

  async parse(input: ParserInput): Promise<ParseResult> {
    const raw = await this.extractText(input)
    const structured = this.extractor.extract(raw, input.filename)

    return {
      content: raw,
      title: structured.title,
      hierarchyPath: structured.hierarchyPath,
      sections: structured.sections,
      codeBlocks: structured.codeBlocks,
      metadata: {
        mimeType: input.mimeType,
        filename: input.filename,
        parser: this.name,
      },
    }
  }

  /**
   * 优先级：pdf-parse → raw-buffer 降级。
   * 若日志出现 "PDF backend degraded to raw-buffer"，请安装 pdf-parse。
   */
  private async extractText(input: ParserInput): Promise<string> {
    const backend = this.resolveBackend()
    if (backend === 'pdf-parse') {
      return this.extractViaPdfParse(input)
    }
    return this.extractViaRawBuffer(input)
  }

  private resolveBackend(): 'pdf-parse' | 'fallback' {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('pdf-parse')
      this.logger.debug('PDF backend: pdf-parse')
      return 'pdf-parse'
    } catch {
      // ignore
    }

    this.logger.warn(
      'PDF backend degraded to raw-buffer (install pdf-parse for production PDF extraction)',
    )
    return 'fallback'
  }

  /** 通过 pdf-parse 解析（可选依赖，动态加载）。 */
  private async extractViaPdfParse(input: ParserInput): Promise<string> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string }>
      const buf = input.buffer
      if (!buf) {
        throw new Error('pdf-parse requires buffer input')
      }
      const result = await pdfParse(buf)
      return result.text
    } catch (err) {
      this.logger.warn(`pdf-parse failed: ${(err as Error).message}`)
      return this.extractViaRawBuffer(input)
    }
  }

  /**
   * 兜底方案：直接把 Buffer 当字符串解码
   *
   * 仅能处理纯文本型 PDF（极少见）。大多数情况下会返回乱码。
   * 主要用于：
   *   - 单元测试环境（无外部依赖）
   *   - 快速验证链路（不关心内容质量）
   */
  private extractViaRawBuffer(input: ParserInput): Promise<string> {
    const raw = input.buffer?.toString('utf-8') ?? ''
    return Promise.resolve(raw)
  }
}
