import { Injectable, Logger } from '@nestjs/common'
import type { LlamaIndexProvider } from '../../modules/chat/llm/llama-index-provider.service.js'
import type { GroundingResult } from './grounding.service.js'
import { GroundingService } from './grounding.service.js'
import { GuardrailService } from './guardrail.service.js'
import { RagContextService } from './rag-context.service.js'
import type { RagQueryOptions, RetrievedChunk } from './rag-types.js'

const SSE_HEARTBEAT_MS = 60_000

type StreamOutcome =
  | { type: 'data'; result: IteratorResult<{ text: string }> }
  | { type: 'heartbeat' }

@Injectable()
export class RagGenerationService {
  private readonly logger = new Logger(RagGenerationService.name)

  constructor(
    private readonly guardrailService: GuardrailService,
    private readonly groundingService: GroundingService,
    private readonly contextService: RagContextService,
  ) {}

  async generateAnswer(
    getLlm: () => LlamaIndexProvider,
    question: string,
    chunks: RetrievedChunk[],
    systemPrompt?: string,
  ): Promise<string> {
    const context = await this.contextService.buildContext(chunks)
    const system = systemPrompt ?? '你是一个基于知识库的问答助手。请根据给定的上下文回答问题。'
    const userPrompt = context
      ? `上下文：\n\n${context}\n\n问题：${question}\n\n请仅根据上下文内容回答。如果上下文没有相关信息，请直接说"没有相关信息"。`
      : `问题：${question}\n\n知识库中没有检索到相关内容，请直接说"没有相关信息"。`

    try {
      return await getLlm().invoke([
        { role: 'system', content: system },
        { role: 'user', content: userPrompt },
      ])
    } catch (err) {
      this.logger.error(`RAG query failed: ${err instanceof Error ? err.message : String(err)}`)
      throw err
    }
  }

  async finalizeAnswer(
    answer: string,
    chunks: RetrievedChunk[],
  ): Promise<{ answer: string; grounding: GroundingResult[]; warnings: string[] }> {
    const guardrailOutcome = this.guardrailService.apply(answer)
    const guardedAnswer = guardrailOutcome.filteredText
    const grounding = await this.groundingService.checkGrounding(
      guardedAnswer,
      chunks.map((c) => ({ id: c.id, content: c.content })),
    )
    return { answer: guardedAnswer, grounding, warnings: guardrailOutcome.warnings }
  }

  async *streamQuery(
    getLlm: () => LlamaIndexProvider,
    question: string,
    chunks: RetrievedChunk[],
    options: RagQueryOptions = {},
  ): AsyncIterable<{
    text: string
    sourceChunks?: RetrievedChunk[]
    grounding?: GroundingResult[]
  }> {
    yield { text: '', sourceChunks: chunks }

    const context = await this.contextService.buildContext(chunks)
    const system =
      options.systemPrompt ?? '你是一个基于知识库的问答助手。请根据给定的上下文回答问题。'
    const userPrompt = context
      ? `上下文：\n\n${context}\n\n问题：${question}\n\n请仅根据上下文内容回答。如果上下文没有相关信息，请直接说"没有相关信息"。`
      : `问题：${question}\n\n知识库中没有检索到相关内容，请直接说"没有相关信息"。`

    const llmStream = getLlm().stream([
      { role: 'system', content: system },
      { role: 'user', content: userPrompt },
    ])

    let buffer = ''
    let lastDataTs = Date.now()
    let lastHeartbeatTs = 0

    async function* withHeartbeat(
      stream: AsyncIterable<{ text: string }>,
    ): AsyncIterable<{ text: string; heartbeat?: boolean }> {
      const iterator = stream[Symbol.asyncIterator]()

      while (true) {
        const dataPromise: Promise<{ type: 'data'; result: IteratorResult<{ text: string }> }> =
          iterator.next().then((r) => ({ type: 'data' as const, result: r }))
        const heartbeatPromise: Promise<{ type: 'heartbeat' }> = new Promise<{ type: 'heartbeat' }>(
          (resolve: (v: { type: 'heartbeat' }) => void) => {
            setTimeout(() => resolve({ type: 'heartbeat' }), SSE_HEARTBEAT_MS)
          },
        )

        const outcome = await Promise.race<StreamOutcome>([dataPromise, heartbeatPromise])

        if (outcome.type === 'heartbeat') {
          if (
            Date.now() - lastDataTs >= SSE_HEARTBEAT_MS &&
            Date.now() - lastHeartbeatTs >= SSE_HEARTBEAT_MS
          ) {
            lastHeartbeatTs = Date.now()
            yield { text: '', heartbeat: true }
          }
          continue
        }

        const { result } = outcome
        if (result.done) break
        lastDataTs = Date.now()
        yield result.value
      }
    }

    for await (const chunk of withHeartbeat(llmStream)) {
      if (chunk.heartbeat) {
        this.logger.debug('SSE heartbeat sent')
        continue
      }
      if (chunk.text) {
        const MAX_BUFFER_LENGTH = 100_000
        if (buffer.length < MAX_BUFFER_LENGTH) {
          buffer += chunk.text
        }
        const filteredText = this.guardrailService.applyStream(chunk.text)
        yield { text: filteredText }
      }
    }

    const guardedBuffer = this.guardrailService.apply(buffer).filteredText

    try {
      const grounding = await this.groundingService.checkGrounding(
        guardedBuffer,
        chunks.map((c) => ({ id: c.id, content: c.content })),
      )
      yield { text: '', grounding }
    } catch (err) {
      this.logger.warn(
        `Grounding check failed in streamQuery: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }
}
