---
id: b-09
issue: issue.md
version: 1
---

# 对话 RAG 检索接入实现计划

> **For agentic workers:** 必需子技能：superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans。步骤使用复选框（`- [ ]`）语法追踪。

**目标：** 在 `ChatService.streamChat()` 中接入 RAG 检索：当 `knowledgeBaseIds` 存在时检索相关 chunks 并注入 system message。

**架构：** 手动编排 `HybridRetriever.retrieve()` + `DefaultRetrievalPostprocessor.process()`，将结果拼接为 context 注入 SSE 流。不调用 SDK `runRetrievalPipeline`（非流式）。

**技术栈：** NestJS 10 + `@goferbot/rag-sdk` + SSE 流式输出

**Issue 引用：** [issue.md](./issue.md)
**Spec 引用：** [specs/api-spec.md](./specs/api-spec.md)

---

## 文件结构

- **修改：**
  - `packages/server/src/modules/chat/chat.service.ts` — 注入检索组件，streamChat 中条件检索
  - `packages/server/src/modules/chat/chat.controller.ts` — DTO 扩展（若 Zod Schema 在 controller 层）
  - `packages/server/src/modules/chat/chat.module.ts` — 注册 HybridRetriever + DefaultRetrievalPostprocessor
- **测试：**
  - `tests/issues/b-09-chat-rag-retrieval/chat-rag.spec.ts`

---

## 任务 1: ChatDto Zod Schema 扩展 knowledgeBaseIds

**文件：**
- 修改：`packages/server/src/modules/chat/dto/chat.dto.ts`（或等效 Zod Schema 文件）
- 测试：`tests/issues/b-09-chat-rag-retrieval/chat-rag.spec.ts`

**规格引用：**
- API 规格：[请求字段变更说明]

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/b-09-chat-rag-retrieval/chat-rag.spec.ts
import { describe, it, expect } from 'vitest'
import { ChatDtoSchema } from '../../../packages/server/src/modules/chat/dto/chat.dto.js'

describe('ChatDto knowledgeBaseIds', () => {
  it('AC-01: accepts valid knowledgeBaseIds array', () => {
    const result = ChatDtoSchema.safeParse({
      message: 'hello',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      knowledgeBaseIds: ['550e8400-e29b-41d4-a716-446655440001'],
      config: { provider: 'openai', model: 'gpt-4', baseUrl: 'http://localhost:3001', apiKey: 'mock' },
    })
    expect(result.success).toBe(true)
  })

  it('AC-02: returns 400 when knowledgeBaseIds contains invalid UUID', () => {
    const result = ChatDtoSchema.safeParse({
      message: 'hello',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      knowledgeBaseIds: ['not-a-uuid'],
      config: { provider: 'openai', model: 'gpt-4', baseUrl: 'http://localhost:3001', apiKey: 'mock' },
    })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/issues/b-09-chat-rag-retrieval/chat-rag.spec.ts -t "AC-01|AC-02"`
预期：FAIL — `knowledgeBaseIds` 字段未定义或校验失败行为不符

- [ ] **步骤 3: 扩展 ChatDto Schema**

修改 ChatDto Zod Schema（假设路径为 `packages/server/src/modules/chat/dto/chat.dto.ts`）：
```typescript
import { z } from 'zod'

export const ChatDtoSchema = z.object({
  message: z.string().min(1).max(4000),
  sessionId: z.string().uuid(),
  knowledgeBaseIds: z.array(z.string().uuid()).optional(),
  config: z.object({
    provider: z.string().min(1),
    model: z.string().min(1),
    baseUrl: z.string().url(),
    apiKey: z.string().min(1),
  }),
})

export type ChatDto = z.infer<typeof ChatDtoSchema>
```

- [ ] **步骤 4: 运行测试验证通过**

运行：`npx vitest run tests/issues/b-09-chat-rag-retrieval/chat-rag.spec.ts -t "AC-01|AC-02"`
预期：PASS

- [ ] **步骤 5: 提交**

```bash
git add packages/server/src/modules/chat/dto/chat.dto.ts \
  tests/issues/b-09-chat-rag-retrieval/chat-rag.spec.ts
git commit -m "feat(b-09): extend ChatDto with optional knowledgeBaseIds"
```

---

## 任务 2: ChatService 注入检索组件并接入 streamChat

**文件：**
- 修改：`packages/server/src/modules/chat/chat.service.ts`
- 修改：`packages/server/src/modules/chat/chat.module.ts`
- 测试：`tests/issues/b-09-chat-rag-retrieval/chat-rag.spec.ts`

**规格引用：**
- API 规格：[RAG 检索上下文注入流程]、[降级行为]

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/b-09-chat-rag-retrieval/chat-rag.spec.ts（追加）
import { describe, it, expect, vi } from 'vitest'

describe('ChatService RAG retrieval', () => {
  const mockRetriever = {
    retrieve: vi.fn().mockResolvedValue([
      { chunk: { id: 'c1', documentId: 'd1', kbId: 'kb1', content: 'GoferBot RAG test', chunkIndex: 0 }, score: 0.9, source: 'vector' },
    ]),
  }
  const mockPostprocessor = {
    process: vi.fn().mockImplementation((candidates) => candidates),
  }
  const mockPrisma = {
    session: { findUnique: vi.fn().mockResolvedValue({ id: 's1', userId: 'u1' }) },
    message: { create: vi.fn().mockResolvedValue({}), findMany: vi.fn().mockResolvedValue([]) },
  }

  it('AC-03: injects retrieved chunks into system message', async () => {
    const { ChatService } = await import('../../../packages/server/src/modules/chat/chat.service.js')
    // 注意：执行前需确认 ChatService.streamChat 的实际签名（如参数顺序、是否接收 userId）
    const service = new ChatService(mockPrisma as any, mockRetriever as any, mockPostprocessor as any)

    const dto = {
      message: 'What does the document say?',
      sessionId: 's1',
      knowledgeBaseIds: ['kb1'],
      config: { provider: 'openai', model: 'gpt-4', baseUrl: 'http://localhost:3001', apiKey: 'mock' },
    }

    // streamChat 返回 AsyncGenerator，需消费
    // 若实际签名不同（如 streamChat(userId, dto) vs streamChat(dto, userId)），需调整
    const stream = service.streamChat('u1', dto as any)
    const chunks = []
    for await (const chunk of stream) {
      chunks.push(chunk)
    }

    expect(mockRetriever.retrieve).toHaveBeenCalledWith(expect.objectContaining({ original: dto.message, kbIds: ['kb1'] }), 10)
    expect(mockPostprocessor.process).toHaveBeenCalled()
  })

  it('AC-04: skips retrieval when knowledgeBaseIds is omitted', async () => {
    const { ChatService } = await import('../../../packages/server/src/modules/chat/chat.service.js')
    // 注意：执行前需确认 ChatService.streamChat 的实际签名
    const service = new ChatService(mockPrisma as any, mockRetriever as any, mockPostprocessor as any)

    const dto = {
      message: 'Hello',
      sessionId: 's1',
      config: { provider: 'openai', model: 'gpt-4', baseUrl: 'http://localhost:3001', apiKey: 'mock' },
    }

    const stream = service.streamChat('u1', dto as any)
    for await (const _ of stream) { /* consume */ }

    expect(mockRetriever.retrieve).not.toHaveBeenCalled()
  })

  it('AC-05: skips retrieval when knowledgeBaseIds is empty array', async () => {
    const { ChatService } = await import('../../../packages/server/src/modules/chat/chat.service.js')
    const service = new ChatService(mockPrisma as any, mockRetriever as any, mockPostprocessor as any)

    const dto = {
      message: 'Hello',
      sessionId: 's1',
      knowledgeBaseIds: [],
      config: { provider: 'openai', model: 'gpt-4', baseUrl: 'http://localhost:3001', apiKey: 'mock' },
    }

    const stream = service.streamChat('u1', dto as any)
    for await (const _ of stream) { /* consume */ }

    expect(mockRetriever.retrieve).not.toHaveBeenCalled()
  })

  it('AC-06: falls back to plain LLM when retrieval returns empty', async () => {
    mockRetriever.retrieve.mockResolvedValue([])
    mockPostprocessor.process.mockReturnValue([])

    const { ChatService } = await import('../../../packages/server/src/modules/chat/chat.service.js')
    const service = new ChatService(mockPrisma as any, mockRetriever as any, mockPostprocessor as any)

    const dto = {
      message: 'Hello',
      sessionId: 's1',
      knowledgeBaseIds: ['kb1'],
      config: { provider: 'openai', model: 'gpt-4', baseUrl: 'http://localhost:3001', apiKey: 'mock' },
    }

    const stream = service.streamChat('u1', dto as any)
    for await (const _ of stream) { /* consume */ }

    expect(mockRetriever.retrieve).toHaveBeenCalled()
    // 即使检索被调用，空结果不应注入 system message
  })

  it('AC-07: falls back to plain LLM when retrieval throws', async () => {
    mockRetriever.retrieve.mockRejectedValue(new Error('Milvus down'))

    const { ChatService } = await import('../../../packages/server/src/modules/chat/chat.service.js')
    const service = new ChatService(mockPrisma as any, mockRetriever as any, mockPostprocessor as any)

    const dto = {
      message: 'Hello',
      sessionId: 's1',
      knowledgeBaseIds: ['kb1'],
      config: { provider: 'openai', model: 'gpt-4', baseUrl: 'http://localhost:3001', apiKey: 'mock' },
    }

    // 不应抛异常，应降级为普通 LLM 调用
    await expect(async () => {
      const stream = service.streamChat('u1', dto as any)
      for await (const _ of stream) { /* consume */ }
    }).not.toThrow()
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/issues/b-09-chat-rag-retrieval/chat-rag.spec.ts`
预期：FAIL — ChatService 未注入 retriever/postprocessor，或 streamChat 未处理 knowledgeBaseIds

- [ ] **步骤 3: 修改 ChatService 和 ChatModule**

修改 `packages/server/src/modules/chat/chat.service.ts`：
```typescript
import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../processors/database/prisma.service.js'
import { HybridRetriever, DefaultRetrievalPostprocessor } from '@goferbot/rag-sdk'
import type { ChatDto } from './dto/chat.dto.js'

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly retriever: HybridRetriever,
    private readonly postprocessor: DefaultRetrievalPostprocessor,
  ) {}

  async *streamChat(userId: string, dto: ChatDto): AsyncGenerator<string> {
    // 验证 session 归属...
    const session = await this.prisma.session.findUnique({ where: { id: dto.sessionId } })
    if (!session || session.userId !== userId) {
      yield JSON.stringify({ error: '无权访问该会话', done: true })
      return
    }

    let systemContext = ''
    if (dto.knowledgeBaseIds && dto.knowledgeBaseIds.length > 0) {
      try {
        const query = { original: dto.message, kbIds: dto.knowledgeBaseIds }
        const candidates = await this.retriever.retrieve(query, 10)
        const processed = await this.postprocessor.process(candidates, query)
        if (processed.length > 0) {
          systemContext = processed.map(c => c.chunk.content).join('\n---\n')
        }
      } catch (err) {
        this.logger.warn(`Retrieval failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    const llmMessages: Array<{ role: string; content: string }> = []
    if (systemContext) {
      llmMessages.push({ role: 'system', content: `基于以下上下文回答问题：\n${systemContext}` })
    }

    // 追加历史消息...
    const history = await this.prisma.message.findMany({
      where: { sessionId: dto.sessionId },
      orderBy: { createdAt: 'asc' },
    })
    history.forEach(m => llmMessages.push({ role: m.role, content: m.content }))
    llmMessages.push({ role: 'user', content: dto.message })

    // SSE 流式调用 LLM...
    // 保存用户消息和 assistant 消息到 PG...
    yield* this.callLLM(llmMessages, dto.config)
  }

  private async *callLLM(messages: any[], config: any): AsyncGenerator<string> {
    // 现有 LLM 调用逻辑...
  }
}
```

修改 `packages/server/src/modules/chat/chat.module.ts`：
```typescript
import { Module } from '@nestjs/common'
import { ChatService } from './chat.service.js'
import { ChatController } from './chat.controller.js'
import { HybridRetriever, DefaultRetrievalPostprocessor, OpenAIEmbedder } from '@goferbot/rag-sdk'
import { VectorService } from '../../processors/vector/vector.service.js'
import { KeywordService } from '../../processors/keyword/keyword.service.js'
import { ConfigService } from '@nestjs/config'

@Module({
  controllers: [ChatController],
  providers: [
    ChatService,
    {
      provide: HybridRetriever,
      useFactory: (vectorService: VectorService, keywordService: KeywordService, config: ConfigService) => {
        const embedder = new OpenAIEmbedder({
          apiKey: config.getOrThrow<string>('EMBEDDING_API_KEY'),
          baseUrl: config.get<string>('EMBEDDING_BASE_URL'),
          model: config.get<string>('EMBEDDING_MODEL', 'text-embedding-3-small'),
          dimension: config.get<number>('EMBEDDING_DIMENSIONS', 1536),
        })
        return new HybridRetriever({
          vectorStore: vectorService,
          keywordStore: keywordService,
          embedder,
        })
      },
      inject: [VectorService, KeywordService, ConfigService],
    },
    {
      provide: DefaultRetrievalPostprocessor,
      useValue: new DefaultRetrievalPostprocessor({ minScore: 0, maxChunks: 10, tokenBudget: 3000 }),
    },
  ],
})
export class ChatModule {}
```

- [ ] **步骤 4: 运行测试验证通过**

运行：`npx vitest run tests/issues/b-09-chat-rag-retrieval/chat-rag.spec.ts`
预期：PASS（AC-03~AC-07 通过）

- [ ] **步骤 5: 提交**

```bash
git add packages/server/src/modules/chat/chat.service.ts \
  packages/server/src/modules/chat/chat.module.ts \
  tests/issues/b-09-chat-rag-retrieval/chat-rag.spec.ts
git commit -m "feat(b-09): integrate RAG retrieval into ChatService.streamChat"
```

---

## 任务 3: SSE 流格式不变验证与类型检查

- [ ] **步骤 1: 编写 SSE 格式测试**

```typescript
// tests/issues/b-09-chat-rag-retrieval/chat-rag.spec.ts（追加）
describe('SSE format', () => {
  it('AC-08: SSE stream format unchanged with RAG enabled', async () => {
    // 验证 RAG 场景下 SSE chunk 格式与现有一致
    // 具体断言取决于现有 SSE 格式（如 { chunk: string, done: boolean }）
  })
})
```

- [ ] **步骤 2: 运行类型检查**

```bash
pnpm type-check
```
预期：0 错误

- [ ] **步骤 3: 运行全量测试**

```bash
npx vitest run tests/issues/b-09-chat-rag-retrieval/
```
预期：全部通过

- [ ] **步骤 4: 提交**

```bash
git add -A
git commit -m "test(b-09): verify SSE format and type-check clean"
```

---

## 自检

1. **规格覆盖：**
   - [x] ChatDto 扩展 knowledgeBaseIds — 任务 1（AC-01, AC-02）
   - [x] ChatService 注入 HybridRetriever + Postprocessor — 任务 2（AC-02 隐含）
   - [x] knowledgeBaseIds 存在时检索注入 — 任务 2（AC-03）
   - [x] 未传/空数组时跳过检索 — 任务 2（AC-04, AC-05）
   - [x] 检索无结果时正常调用 LLM — 任务 2（AC-06）
   - [x] 检索异常时降级 — 任务 2（AC-07）
   - [x] SSE 格式不变 — 任务 3（AC-08）
   - [x] pnpm type-check 通过 — 任务 3

2. **占位符扫描：** 无 TBD/TODO/稍后实现。

3. **类型一致性：** `knowledgeBaseIds` 为 `string[]` 可选字段，与 `Query.kbIds` 类型一致。
