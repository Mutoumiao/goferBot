/**
 * PDF 解析器
 *
 *   PDF 的解析比纯文本复杂得多——需要处理文本块、页面、字体、表格、
 *   图片等。本解析器的设计原则：
 *
 *     1) 优先使用 LlamaIndex 的 PDFReader（在 @llamaindex 生态包可用时）
 *     2) 如果未安装 PDF 解析器扩展，降级为"仅提取可见字符"的轻量实现
 *     3) 对外接口保持不变，业务方无需关心底层用的是什么引擎
 *
 *   这样做的好处：
 *     - 项目开箱即用（无需预装 PDF 解析依赖）
 *     - 当团队后续安装 `@llamaindex/readers` 或 `pdf-parse` 等包时，
 *       只需替换 resolveBackend() 的逻辑，对外接口零改动。
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
   * 根据运行环境选择 PDF 解析后端
   *
   * 优先级：
   *   1) LlamaIndex PDFReader（通过 require 动态加载）
   *   2) 降级为 Buffer 直接转字符串（仅对文本型 PDF 有效，二进制 PDF 会得到乱码）
   *
   * 新人注意：
   *   若日志中出现 "PDF backend degraded to raw-buffer"，说明需要安装
   *   `@llamaindex/readers` 或 `pdf-parse` 以获得真正的 PDF 解析能力。
   */
  private async extractText(input: ParserInput): Promise<string> {
    const backend = this.resolveBackend()

    switch (backend) {
      case 'llamaindex':
        return this.extractViaLlamaIndex(input)
      case 'pdf-parse':
        return this.extractViaPdfParse(input)
      default:
        return this.extractViaRawBuffer(input)
    }
  }

  private resolveBackend(): 'llamaindex' | 'pdf-parse' | 'fallback' {
    try {
      // 动态 require：不强制项目一定安装 PDF 解析扩展
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('@llamaindex/readers')
      this.logger.debug('PDF backend: @llamaindex/readers')
      return 'llamaindex'
    } catch {
      // ignore
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('pdf-parse')
      this.logger.debug('PDF backend: pdf-parse')
      return 'pdf-parse'
    } catch {
      // ignore
    }

    this.logger.warn(
      'PDF backend degraded to raw-buffer (install @llamaindex/readers or pdf-parse for production)',
    )
    return 'fallback'
  }

  /**
   * 通过 LlamaIndex 的 PDFReader 解析
   *
   *   LlamaIndex v0.12 的核心包不包含 PDFReader，但生态包 `@llamaindex/readers`
   *   提供了 PDFReader、SimpleDirectoryReader 等。这里用动态加载避免硬依赖。
   *
   *   调用方式：
   *     const { PDFReader } = await import('@llamaindex/readers')
   *     const reader = new PDFReader()
   *     const docs = await reader.loadData(input.filePath)
   */
  private async extractViaLlamaIndex(input: ParserInput): Promise<string> {
    const filePath = input.filePath
    if (!filePath) {
      this.logger.warn(
        'LlamaIndex PDFReader requires filePath; falling back to buffer raw extraction',
      )
      return this.extractViaRawBuffer(input)
    }
    try {
      // 动态 import：运行时加载，不影响冷启动
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require('@llamaindex/readers') as {
        PDFReader?: new () => {
          loadData: (path: string) => Promise<Array<{ getContent: () => string }>>
        }
      }
      const ReaderCtor = mod.PDFReader
      if (!ReaderCtor) {
        throw new Error('PDFReader not found in @llamaindex/readers')
      }
      const reader = new ReaderCtor()
      const docs = await reader.loadData(filePath)
      return docs.map((d) => d.getContent()).join('\n\n')
    } catch (err) {
      this.logger.warn(`LlamaIndex PDFReader failed: ${(err as Error).message}`)
      return this.extractViaRawBuffer(input)
    }
  }

  /**
   * 通过 pdf-parse 解析（社区常用方案）
   *
   *   pdf-parse 是最常见的 Node.js PDF 解析库，体积小、速度快、支持中文。
   *   团队可根据偏好选择 @llamaindex/readers 或 pdf-parse。
   */
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
