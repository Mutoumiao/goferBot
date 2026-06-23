/**
 * 解析器通用契约
 *
 *   设计说明（Ponytail 准则下的双轨制）：
 *     - Zod Schema 定义在 `@goferbot/data/schemas`（单一真源）
 *     - TS 类型在本文件显式声明（因为 server 用 zod v4、data 用 zod v3，
 *       z.infer 跨版本传递会丢失类型）
 *     - 服务边界用 Zod 做运行时校验（parse/parseSafe）
 *     - 类型必须与 Schema 保持同步——新增字段时两处都要改（代价极低）
 */
import {
  codeBlockSchema,
  parseResultSchema,
  parserInputSchema,
  parserMetaSchema,
  sectionBlockSchema,
} from '@goferbot/data/schemas'

export {
  codeBlockSchema,
  parseResultSchema,
  parserInputSchema,
  parserMetaSchema,
  sectionBlockSchema,
}

/** 解析器输入：Buffer 与 filePath 至少一个，MIME 必填 */
export interface ParserInput {
  filename?: string
  mimeType: string
  buffer?: Buffer
  filePath?: string
}

/** 解析结果 */
export interface ParseResult {
  content: string
  title?: string
  hierarchyPath?: string[]
  sections: SectionBlock[]
  codeBlocks?: CodeBlock[]
  metadata?: Record<string, unknown>
}

/** 章节块 */
export interface SectionBlock {
  heading?: string
  level: number
  content: string
}

/** 代码块 */
export interface CodeBlock {
  language: string
  content: string
}

/** 解析器元数据（用于日志、可观测性） */
export interface ParserMeta {
  name: string
  mimeTypes: string[]
}

/**
 * 解析器接口 —— 对外开放的自定义解析器契约
 *
 *   若业务方需要新增解析器（如飞书/Notion/Confluence），只需实现本接口，
 *   然后调用 `DocumentParser.register()` 或通过 NestJS 依赖注入注册即可。
 *
 *   示例：
 *     ```ts
 *     class FeishuParser implements IDocumentParser {
 *       readonly name = 'feishu'
 *       readonly mimeTypes = ['application/vnd.feishu.doc']
 *       async parse(input: ParserInput) { ... }
 *     }
 *     ```
 */
export interface IDocumentParser {
  readonly name: string
  readonly mimeTypes: string[]
  parse(input: ParserInput): Promise<ParseResult>
}
