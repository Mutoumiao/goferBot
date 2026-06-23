/**
 * 纯文本 / Markdown 解析器
 *
 *   最简单的解析器——直接返回原文。但它仍然做了一件事：
 *   调用 StructureExtractor 识别 Markdown 标题层级、代码块，
 *   让后续的 Parent-Child 分块能够按结构切割，而不是按字符数硬切。
 */
import type {
  IDocumentParser,
  ParseResult,
  ParserInput,
} from './parser.types.js'
import { StructureExtractor } from './structure-extractor.js'

export class TextParser implements IDocumentParser {
  readonly name = 'text'
  readonly mimeTypes = [
    'text/plain',
    'text/markdown',
    'text/x-markdown',
    'text/html',
  ]

  constructor(private readonly extractor: StructureExtractor = new StructureExtractor()) { }

  parse(input: ParserInput): Promise<ParseResult> {
    const raw = input.buffer?.toString('utf-8') ?? ''
    const structured = this.extractor.extract(raw, input.filename)
    return Promise.resolve({
      content: raw,
      title: structured.title,
      hierarchyPath: structured.hierarchyPath,
      sections: structured.sections,
      codeBlocks: structured.codeBlocks,
      metadata: {
        mimeType: input.mimeType,
        filename: input.filename,
      },
    })
  }
}
