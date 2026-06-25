import { z } from 'zod'

/**
 * RAG 模块解析器 + 索引相关的共享 Zod Schema
 *
 *   设计原则：
 *     - 与 `packages/server/src/processors/rag/dto/rag.schema.ts` 的元数据白名单保持一致
 *     - 服务边界用 Zod 校验；内部实现用 `z.infer<>` 派生的 TS 类型
 *     - 禁止在运行时"信任"外部输入 —— 即便在内部 Worker 边界也要校验
 */

/* ==================== 解析器契约 ==================== */

/** 代码块 */
export const codeBlockSchema = z.object({
  language: z.string().min(1, '代码语言不能为空').max(64),
  content: z.string().min(1, '代码内容不能为空').max(100_000),
})

/** 章节块 */
export const sectionBlockSchema = z.object({
  heading: z.string().max(500).optional(),
  level: z.number().int().min(0).max(6, '标题层级必须在 0-6 之间'),
  content: z.string().max(500_000),
})

/** 解析器输入 —— Buffer 与 filePath 至少提供一个，MIME 必填 */
export const parserInputSchema = z
  .object({
    filename: z.string().max(255).optional(),
    mimeType: z.string().min(1, 'mimeType 不能为空').max(128),
    // 注意：Zod 无法直接描述 Node Buffer，这里用 z.instanceof(Buffer) 做运行时校验
    buffer: z.instanceof(Buffer).optional(),
    filePath: z.string().min(1).max(1024).optional(),
  })
  .refine(({ buffer, filePath }) => buffer !== undefined || filePath !== undefined, {
    message: 'buffer 与 filePath 至少提供一个',
    path: ['buffer'],
  })

/** 解析结果 */
export const parseResultSchema = z.object({
  content: z.string().min(1, 'content 不能为空').max(5_000_000),
  title: z.string().max(500).optional(),
  hierarchyPath: z.array(z.string().max(500)).optional(),
  sections: z.array(sectionBlockSchema).default([]),
  codeBlocks: z.array(codeBlockSchema).optional(),
  // ponytail: metadata 用 z.record(z.string(), z.unknown()) 保持通用性
  // 业务侧使用时再按 rag.schema.ts 的白名单解析
  metadata: z.record(z.string(), z.unknown()).optional(),
})

/** 解析器元数据（用于日志） */
export const parserMetaSchema = z.object({
  name: z.string().min(1).max(64),
  mimeTypes: z.array(z.string().min(1).max(128)),
})

/* ==================== 索引选项 ==================== */

/** 索引选项 —— 对应 indexDocument 的 options 参数 */
export const indexOptionsSchema = z.object({
  childChunkSize: z.number().int().min(50).max(4000).optional(),
  parentChild: z.boolean().optional(),
  allowedUserIds: z.array(z.string().uuid()).optional(),
  allowedTeamIds: z.array(z.string().uuid()).optional(),
  documentTitle: z.string().max(500).optional(),
  sectionPath: z.string().max(1000).optional(),
  userId: z.string().optional(),
})

/** 索引请求体 —— 用于 Worker 边界校验 */
export const indexRequestSchema = z.object({
  documentId: z.string().min(1).max(256),
  kbId: z.string().min(1).max(256),
  content: z.string().min(1).max(2_000_000),
  chunkSize: z.number().int().min(100).max(8000).optional(),
  overlap: z.number().int().min(0).max(2000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  options: indexOptionsSchema.optional(),
})

/** 索引结果 */
export const indexResultSchema = z.object({
  totalChunks: z.number().int().min(0),
})

/* ==================== 派生 TypeScript 类型 ==================== */

export type CodeBlock = z.infer<typeof codeBlockSchema>
export type SectionBlock = z.infer<typeof sectionBlockSchema>
export type ParserInput = z.infer<typeof parserInputSchema>
export type ParseResult = z.infer<typeof parseResultSchema>
export type IndexOptions = z.infer<typeof indexOptionsSchema>
export type IndexRequest = z.infer<typeof indexRequestSchema>
export type IndexResult = z.infer<typeof indexResultSchema>
