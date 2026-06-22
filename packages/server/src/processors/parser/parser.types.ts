/**
 * 解析器通用上下文
 *
 *   不同解析器的输入可能不同（Buffer、路径、远程 URL），输出也可能不同
 *   （纯文本、带结构的对象）。本文件统一定义输入/输出的契约。
 */

/** 解析器输入：支持 Buffer（上传文件）或文件路径（本地文件） */
export interface ParserInput {
  /** 文件名（可选），用于推断扩展名 */
  filename?: string
  /** MIME 类型，优先用于路由解析器 */
  mimeType: string
  /** 文件二进制内容（上传场景） */
  buffer?: Buffer
  /** 本地文件路径（可选，部分解析器支持直接读文件） */
  filePath?: string
}

/** 解析后输出的结构化结果 */
export interface ParseResult {
  /** 纯文本内容（用于 Embedding / 生成） */
  content: string
  /** 文档标题（若能识别） */
  title?: string
  /** 章节层级路径（如 ["React18新特性", "并发渲染"]） */
  hierarchyPath?: string[]
  /** 章节块（结构化的 section 列表） */
  sections: SectionBlock[]
  /** 代码块（可选） */
  codeBlocks?: CodeBlock[]
  /** 解析器识别到的元信息（页数、作者等） */
  metadata?: Record<string, unknown>
}

/** 一个章节块 */
export interface SectionBlock {
  /** 章节标题（可为空，表示正文段落） */
  heading?: string
  /** 标题层级（1-6，Markdown 语义） */
  level: number
  /** 章节正文 */
  content: string
}

/** 一个代码块 */
export interface CodeBlock {
  language: string
  content: string
}

/**
 * 解析器接口 —— 对外开放的自定义解析器契约
 *
 * 新人理解：
 *   若业务方需要新增解析器（如飞书/Notion/Confluence），只需实现本接口，
 *   然后调用 `DocumentParser.register()` 或通过 NestJS 依赖注入注册即可。
 *
 * 示例：
 *   ```ts
 *   class FeishuParser implements IDocumentParser {
 *     readonly name = 'feishu'
 *     readonly mimeTypes = ['application/vnd.feishu.doc']
 *     async parse(input: ParserInput) { ... }
 *   }
 *   ```
 */
export interface IDocumentParser {
  /** 解析器名称（用于日志） */
  readonly name: string
  /** 支持的 MIME 类型列表（如 ['application/pdf']） */
  readonly mimeTypes: string[]
  /** 执行解析 */
  parse(input: ParserInput): Promise<ParseResult>
}
