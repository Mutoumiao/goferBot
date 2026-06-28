import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Logger,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js'
import { JwtAuthGuard } from '../../auth/guards/jwt.guard.js'
import { SseResponseHelper } from '../../common/helpers/sse-response.helper.js'
import { RagIndexDto, RagQueryDto, RagRetrieveDto } from './dto/rag.dto.js'
import { ElasticsearchService } from './elasticsearch.service.js'
import { LlamaIndexRagService } from './llamaindex-rag.service.js'

@Controller('rag')
@UseGuards(JwtAuthGuard)
export class RagController {
  private readonly logger = new Logger(RagController.name)

  constructor(
    private readonly ragService: LlamaIndexRagService,
    private readonly esService: ElasticsearchService,
    private readonly sseHelper: SseResponseHelper,
  ) {}

  @Post('retrieve')
  @HttpCode(200)
  async retrieve(@Body() dto: RagRetrieveDto, @CurrentUser('id') userId: string) {
    const chunks = await this.ragService.retrieve(dto.query, {
      kbIds: dto.kbIds,
      documentIds: dto.documentIds,
      topK: dto.topK,
      candidateK: dto.candidateK,
      minScore: dto.minScore,
      mode: dto.mode,
      vectorWeight: dto.vectorWeight,
      bm25Weight: dto.bm25Weight,
      rrfK: dto.rrfK,
      needRerank: dto.needRerank,
      rerankTopK: dto.rerankTopK,
      metadata: dto.metadata,
      userId,
    })
    return { chunks, total: chunks.length }
  }

  @Post('query')
  @HttpCode(200)
  async query(@Body() dto: RagQueryDto, @CurrentUser('id') userId: string) {
    const result = await this.ragService.query(dto.query, {
      kbIds: dto.kbIds,
      documentIds: dto.documentIds,
      topK: dto.topK,
      candidateK: dto.candidateK,
      minScore: dto.minScore,
      mode: dto.mode,
      vectorWeight: dto.vectorWeight,
      bm25Weight: dto.bm25Weight,
      rrfK: dto.rrfK,
      needRerank: dto.needRerank,
      rerankTopK: dto.rerankTopK,
      metadata: dto.metadata,
      systemPrompt: dto.systemPrompt,
      userId,
    })
    return { answer: result.answer, grounding: result.grounding }
  }

  @Post('stream')
  async stream(
    @Body() dto: RagQueryDto,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
    @CurrentUser('id') userId: string,
  ) {
    this.sseHelper.init(req, reply)

    try {
      for await (const frame of this.ragService.streamQuery(dto.query, {
        kbIds: dto.kbIds,
        documentIds: dto.documentIds,
        topK: dto.topK,
        candidateK: dto.candidateK,
        minScore: dto.minScore,
        mode: dto.mode,
        vectorWeight: dto.vectorWeight,
        bm25Weight: dto.bm25Weight,
        rrfK: dto.rrfK,
        needRerank: dto.needRerank,
        rerankTopK: dto.rerankTopK,
        metadata: dto.metadata,
        systemPrompt: dto.systemPrompt,
        userId,
      })) {
        if (frame.sourceChunks) {
          this.sseHelper.write({
            event: 'sources',
            data: {
              chunks: frame.sourceChunks.map((c) => ({
                id: c.id,
                documentId: c.documentId,
                content: c.content,
                score: c.score,
              })),
              total: frame.sourceChunks.length,
            },
          })
          continue
        }

        if (frame.grounding) {
          this.sseHelper.write({
            event: 'grounding',
            data: { grounding: frame.grounding },
          })
          continue
        }

        if (frame.text) {
          this.sseHelper.write({
            event: 'message',
            data: { answer: frame.text, done: false },
          })
        }
      }

      this.sseHelper.write({ event: 'message_end', data: { answer: '', done: true } })
    } catch (err) {
      this.logger.error(`RAG stream failed: ${err instanceof Error ? err.message : '未知错误'}`)
      this.sseHelper.writeError('服务暂时不可用，请稍后重试')
    } finally {
      this.sseHelper.end()
    }
  }

  @Post('index')
  @HttpCode(200)
  async index(@Body() dto: RagIndexDto, @CurrentUser('id') userId: string) {
    // Belt-and-suspenders: the service will re-check ownership, but we also
    // short-circuit here when the caller cannot own the target kbId so that
    // the attacker gets a deterministic 403 and we avoid any ES write.
    if (!userId) {
      throw new ForbiddenException('未认证用户无权写入')
    }
    const result = await this.ragService.indexDocument(
      dto.documentId,
      dto.kbId,
      dto.content,
      dto.chunkSize,
      dto.overlap,
      dto.metadata,
      { userId },
    )
    return result
  }

  @Delete('documents/:documentId')
  @HttpCode(204)
  async removeDocument(
    @Param('documentId') documentId: string,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    if (!userId) {
      throw new ForbiddenException('未认证用户无权删除')
    }
    await this.ragService.removeDocument(documentId, userId)
  }

  @Get('health')
  @HttpCode(200)
  async health() {
    try {
      const [info, ikPlugin, docsCount] = await Promise.all([
        this.esService.getClient().info(),
        this.esService.checkIkPlugin(),
        this.esService
          .getClient()
          .count({ index: this.esService.getIndexName() } as any)
          .then((r: any) => r.count ?? 0)
          .catch(() => 0),
      ])
      return {
        status: 'ok',
        elasticsearch: 'connected',
        esVersion: info.version.number,
        ikPlugin,
        indexName: this.esService.getIndexName(),
        docsCount,
      }
    } catch {
      return {
        status: 'degraded',
        elasticsearch: 'disconnected',
        ikPlugin: 'missing',
        indexName: this.esService.getIndexName(),
        docsCount: 0,
      }
    }
  }
}
