import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import type { LlamaIndexProviderConfig } from '../../modules/chat/llm/llama-index-provider.service.js'
import {
  LlamaIndexProvider,
  resolveLlmBaseURL,
} from '../../modules/chat/llm/llama-index-provider.service.js'
import { ConfigChangedEvent, MODEL_PROVIDER_ERROR_CODES } from '../../modules/settings/constants.js'
import type { ResolvedProvider, Settings } from '../../modules/settings/dto/settings.dto.js'
import { ModelProviderService } from '../../modules/settings/model-provider.service.js'
import { SystemConfigService } from '../../modules/settings/system-config.service.js'
import type { GroundingResult } from './grounding.service.js'
import { RagContextService } from './rag-context.service.js'
import { RagGenerationService } from './rag-generation.service.js'
import { RagIndexingService } from './rag-indexing.service.js'
import { RagRetrievalService } from './rag-retrieval.service.js'
import {
  type RagMetadataFilter,
  type RagMetadataValue,
  type RagQueryOptions,
  type RagQueryResult,
  type RagRetrieveOptions,
  type RetrievalMode,
  type RetrievedChunk,
} from './rag-types.js'

export type {
  RagMetadataFilter,
  RagMetadataValue,
  RagQueryOptions,
  RagQueryResult,
  RagRetrieveOptions,
  RetrievalMode,
  RetrievedChunk,
}

const RAG_PROVIDER_SCOPE = 'llm'

/**
 * LlamaIndexRagService —— RAG 系统的总编排器（现已为薄封装）
 *
 * 本服务保留公共 API（retrieve/query/streamQuery/indexDocument/removeDocument）
 * 与配置刷新逻辑，实际工作委托给四个子服务：
 *   - RagRetrievalService  检索（混合检索/RRF/重排/Parent-Child 聚合）
 *   - RagContextService    上下文构建（去重/截断/编号引用）
 *   - RagGenerationService 生成（LLM 调用/流式 SSE 心跳/Guardrail/Grounding）
 *   - RagIndexingService   索引（切分/Embedding/批量写入/删除）
 */
@Injectable()
export class LlamaIndexRagService implements OnModuleInit {
  private readonly logger = new Logger(LlamaIndexRagService.name)
  private llm: LlamaIndexProvider | null = null

  constructor(
    private readonly retrievalService: RagRetrievalService,
    private readonly contextService: RagContextService,
    private readonly generationService: RagGenerationService,
    private readonly indexingService: RagIndexingService,
    private readonly systemConfigService: SystemConfigService,
    private readonly modelProviderService: ModelProviderService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refreshConfig()
  }

  @OnEvent('config.changed')
  async handleConfigChanged(event: ConfigChangedEvent): Promise<void> {
    if (
      event.category === 'rag' ||
      event.category === 'indexing' ||
      event.category === 'providers'
    ) {
      await this.refreshConfig()
    }
  }

  private async refreshConfig(): Promise<void> {
    const config = await this.systemConfigService.getDecryptedSystemConfig()
    this.applyRagConfig(config)
    this.applyIndexingConfig(config.indexing)
  }

  private applyRagConfig(config: Settings): void {
    const providerId = config.rag.llmProvider
    if (!providerId) {
      this.logger.warn('RAG LLM 未配置：请在管理后台配置 rag.llmProvider')
      this.llm = null
      return
    }

    let provider: ResolvedProvider
    try {
      provider = this.modelProviderService.resolveProvider(
        'rag.llmProvider',
        RAG_PROVIDER_SCOPE,
        config,
      )
    } catch (err) {
      this.logger.warn(
        `RAG LLM provider 解析失败：${err instanceof Error ? err.message : String(err)}`,
      )
      this.llm = null
      return
    }

    if (!provider.apiKey) {
      this.logger.warn('RAG LLM 未配置：缺少 API Key')
      this.llm = null
      return
    }

    this.llm = new LlamaIndexProvider({
      apiKey: provider.apiKey,
      model: provider.model,
      baseURL: resolveLlmBaseURL(provider.baseUrl, provider.isCompleteUrl),
      timeout: config.rag.timeoutMs ?? provider.timeoutMs,
    } satisfies LlamaIndexProviderConfig)
    this.logger.debug(`RAG LLM refreshed: ${provider.model}`)
  }

  private applyIndexingConfig(indexing: Settings['indexing']): void {
    this.indexingService.applyConfig({
      parentChunkSize: indexing.parentChunkSize,
      childChunkSize: indexing.childChunkSize,
      contextualWindow: Math.max(1, indexing.contextualWindow),
      enableContextualEmbedding: indexing.contextualEmbedding,
    })
  }

  private getLlm(): LlamaIndexProvider {
    if (!this.llm) {
      throw new BadRequestException({
        code: MODEL_PROVIDER_ERROR_CODES.NOT_CONFIGURED,
        message: 'RAG LLM 未配置：请在管理后台配置 rag.llmProvider',
      })
    }
    return this.llm
  }

  async retrieve(query: string, options: RagRetrieveOptions = {}): Promise<RetrievedChunk[]> {
    return this.retrievalService.retrieve(query, options)
  }

  async query(question: string, options: RagQueryOptions = {}): Promise<RagQueryResult> {
    const chunks = await this.retrievalService.retrieve(question, options)
    const rawAnswer = await this.generationService.generateAnswer(
      () => this.getLlm(),
      question,
      chunks,
      options.systemPrompt,
    )
    const { answer, grounding, warnings } = await this.generationService.finalizeAnswer(
      rawAnswer,
      chunks,
    )

    if (warnings.length > 0) {
      this.logger.warn(`[Guardrail] warnings during query: ${warnings.join('; ')}`)
    }

    return { answer, grounding }
  }

  async *streamQuery(
    question: string,
    options: RagQueryOptions = {},
  ): AsyncIterable<{
    text: string
    sourceChunks?: RetrievedChunk[]
    grounding?: GroundingResult[]
  }> {
    const chunks = await this.retrievalService.retrieve(question, options)
    for await (const event of this.generationService.streamQuery(
      () => this.getLlm(),
      question,
      chunks,
      options,
    )) {
      yield event
    }
  }

  async indexDocument(
    documentId: string,
    kbId: string,
    content: string,
    chunkSize?: number,
    overlap?: number,
    metadata?: Record<string, unknown>,
    options?: {
      childChunkSize?: number
      parentChild?: boolean
      allowedUserIds?: string[]
      allowedTeamIds?: string[]
      documentTitle?: string
      sectionPath?: string
      userId?: string
    },
  ): Promise<{ totalChunks: number }> {
    return this.indexingService.indexDocument(
      documentId,
      kbId,
      content,
      chunkSize,
      overlap,
      metadata,
      options,
    )
  }

  async removeDocument(documentId: string, userId?: string): Promise<void> {
    return this.indexingService.removeDocument(documentId, userId)
  }

  buildContext(chunks: RetrievedChunk[], tokenBudget?: number): Promise<string> {
    return this.contextService.buildContext(chunks, tokenBudget)
  }

  splitIntoChunks(text: string, chunkSize: number, overlap: number): string[] {
    return this.indexingService.splitIntoChunks(text, chunkSize, overlap)
  }

  dedupeHits(hits: any[]): any[] {
    return this.retrievalService.dedupeHits(hits)
  }

  reciprocalRankFusion(vectorHits: any[], bm25Hits: any[], options?: RagRetrieveOptions): any[] {
    return this.retrievalService.reciprocalRankFusion(vectorHits, bm25Hits, options)
  }
}
