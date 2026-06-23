/**
 * DocumentParser —— 文档解析器调度中心（策略模式）
 *
 *   本服务不直接解析文档，而是按 MIME 类型将解析任务**分派**给注册的解析器。
 *   业务方可以随时注册自定义解析器（如飞书、Notion、Confluence 等），
 *   主流程零改动。
 *
 * 注册方式（两种）：
 *   1) 通过构造函数注入（NestJS DI 推荐）：
 *        new DocumentParser([new PdfParser(), new TextParser()])
 *   2) 运行时动态注册：
 *        parser.register(new FeishuParser())
 *
 * 兜底策略：
 *   若没有匹配的解析器，默认按 UTF-8 解析（适合纯文本场景，对 PDF/Word 会失败）。
 *
 * 返回结构：
 *   ParseResult { content, title, hierarchyPath, sections, codeBlocks, metadata }
 *   后续的 Chunking / Embedding / Indexing 都会用到这些结构化信息。
 */
import { Injectable, Logger } from '@nestjs/common'
import {
  parseResultSchema,
  parserInputSchema,
  type IDocumentParser,
  type ParseResult,
  type ParserInput,
} from './parser.types.js'
import { TextParser } from './text.parser.js'
import { PdfParser } from './pdf.parser.js'

@Injectable()
export class DocumentParser {
  private readonly logger = new Logger(DocumentParser.name)
  private readonly parsers = new Map<string, IDocumentParser>()
  private readonly mimeIndex = new Map<string, IDocumentParser>()

  constructor(parsers: IDocumentParser[] = []) {
    // 默认注册内置解析器
    const defaults: IDocumentParser[] = [new TextParser(), new PdfParser()]
      ;[...defaults, ...parsers].forEach((p) => this.register(p))
  }

  /** 注册一个解析器（重复注册会覆盖同名解析器） */
  register(parser: IDocumentParser): void {
    this.parsers.set(parser.name, parser)
    for (const mime of parser.mimeTypes) {
      this.mimeIndex.set(mime.toLowerCase(), parser)
    }
    this.logger.debug(`Registered parser "${parser.name}" for ${parser.mimeTypes.join(', ')}`)
  }

  /** 注销一个解析器 */
  unregister(name: string): boolean {
    const parser = this.parsers.get(name)
    if (!parser) return false
    for (const mime of parser.mimeTypes) {
      if (this.mimeIndex.get(mime.toLowerCase()) === parser) {
        this.mimeIndex.delete(mime.toLowerCase())
      }
    }
    this.parsers.delete(name)
    return true
  }

  /**
   * 按 MIME 类型分派解析器
   *
   * 流程：
   *   1) 精确匹配 MIME（已注册的解析器）
   *   2) 未命中 → 尝试按文件扩展名推断（如 .pdf → application/pdf）
   *   3) 仍未命中 → 兜底为 UTF-8 文本解析
   *
   * 校验：
   *   - 入参通过 parserInputSchema 校验（Buffer 与 filePath 至少一个）
   *   - 解析结果通过 parseResultSchema 校验（content 非空、限制上限）
   *   - 校验失败时抛 ZodError，Worker 捕获后标记文档为 failed
   */
  async parse(input: ParserInput): Promise<ParseResult> {
    // 入口：Zod 校验，防止非法输入流入解析器
    // ponytail: 显式 cast——data 包用 zod v3、server 用 zod v4，z.infer 在跨版本传递时丢失类型
    const parsedInput = parserInputSchema.parse(input) as ParserInput

    const parser = this.resolveParser(parsedInput.mimeType, parsedInput.filename)

    if (!parser) {
      this.logger.warn(`No parser for mime="${parsedInput.mimeType}", fallback to raw UTF-8`)
      const fallback = await this.fallbackParse(parsedInput)
      return parseResultSchema.parse(fallback) as ParseResult
    }

    this.logger.debug(`Using parser "${parser.name}" for mime="${parsedInput.mimeType}"`)
    const result = await parser.parse(parsedInput)
    // 出口：Zod 校验，确保自定义解析器返回的结构合法
    return parseResultSchema.parse(result) as ParseResult
  }

  /** 保留旧接口签名（只返回纯文本），供快速兼容 */
  async parseText(buffer: Buffer, mimeType: string, filename?: string): Promise<string> {
    const result = await this.parse({ buffer, mimeType, filename })
    return result.content
  }

  /** 列出已注册的解析器（用于健康检查） */
  listParsers(): Array<{ name: string; mimeTypes: string[] }> {
    return Array.from(this.parsers.values()).map((p) => ({
      name: p.name,
      mimeTypes: [...p.mimeTypes],
    }))
  }

  private resolveParser(mimeType: string, filename?: string): IDocumentParser | undefined {
    const exact = this.mimeIndex.get(mimeType.toLowerCase())
    if (exact) return exact

    // 按扩展名推断
    if (filename) {
      const ext = filename.split('.').pop()?.toLowerCase()
      const extMime = EXT_TO_MIME[ext ?? '']
      if (extMime) {
        return this.mimeIndex.get(extMime.toLowerCase())
      }
    }

    return undefined
  }

  private async fallbackParse(input: ParserInput): Promise<ParseResult> {
    const content = input.buffer?.toString('utf-8') ?? ''
    return {
      content,
      sections: [{ level: 0, content }],
      metadata: {
        mimeType: input.mimeType,
        fallback: true,
      },
    }
  }
}

/**
 * 扩展名 → MIME 类型映射（兜底推断）
 *
 * ponytail: 这里不引入 `mime-types`/`mime` 库——
 *   1) 实际业务只用到这几种格式，手写几行映射比加一个依赖更简单；
 *   2) 新增格式的频率极低（按年计），到时候再决定是否引入库；
 *   3) 映射表稳定，不会因为引入新库而减少维护成本。
 *   如果未来需要支持几十种格式，再换成 mime-types。
 */
const EXT_TO_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  md: 'text/markdown',
  markdown: 'text/markdown',
  txt: 'text/plain',
  html: 'text/html',
  htm: 'text/html',
}
