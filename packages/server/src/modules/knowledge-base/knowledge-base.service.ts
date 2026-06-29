import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { CacheService } from '../../shared/cache/cache.service.js'
import type { CreateKbDto } from './dto/create-kb.dto.js'
import type { UpdateKbDto } from './dto/update-kb.dto.js'
import { KnowledgeBaseDeletedEvent } from './events/kb-deleted.event.js'
import { DocumentRepository } from './repositories/document.repository.js'
import { FolderRepository } from './repositories/folder.repository.js'
import { KbRepository } from './repositories/kb.repository.js'

const MAX_SEARCH_QUERY_LENGTH = 100
const MAX_SELECTOR_ITEMS = 100
const MAX_SEARCH_RESULTS = 100
const KB_LIST_CACHE_PREFIX = 'kb:list:'
const KB_LIST_CACHE_TTL = 120

@Injectable()
export class KnowledgeBaseService {
  constructor(
    private readonly kbRepository: KbRepository,
    private readonly folderRepository: FolderRepository,
    private readonly documentRepository: DocumentRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly cacheService: CacheService,
  ) {}

  async list(userId: string, page: number, size: number) {
    const cacheKey = `${KB_LIST_CACHE_PREFIX}${userId}:${page}:${size}`
    const cached = await this.cacheService.get<{
      items: Awaited<ReturnType<KbRepository['findManyByUserIdWithPagination']>>
      total: number
      page: number
      size: number
    }>(cacheKey)
    if (cached) {
      return cached
    }

    const [items, total] = await Promise.all([
      this.kbRepository.findManyByUserIdWithPagination(userId, page, size),
      this.kbRepository.countByUserId(userId),
    ])

    const result = { items, total, page, size }
    await this.cacheService.set(cacheKey, result, KB_LIST_CACHE_TTL)
    return result
  }

  async listForSelector(userId: string) {
    const rows = await this.kbRepository.findManyForSelector(userId, MAX_SELECTOR_ITEMS)

    return rows.map((kb) => ({
      id: kb.id,
      name: kb.name,
      icon: kb.icon ?? undefined,
      isPinned: kb.isPinned,
      sortOrder: kb.sortOrder,
      fileCount: kb._count?.documents ?? 0,
      createdAt: kb.createdAt.toISOString(),
      updatedAt: kb.updatedAt.toISOString(),
    }))
  }

  async create(userId: string, dto: CreateKbDto) {
    const result = await this.kbRepository.create({
      userId,
      name: dto.name,
      description: dto.description ?? null,
      icon: dto.icon ?? null,
    })
    await this.cacheService.delByPrefix(`${KB_LIST_CACHE_PREFIX}${userId}`)
    return result
  }

  async update(userId: string, id: string, dto: UpdateKbDto) {
    await this.ensureOwnership(userId, id)

    const result = await this.kbRepository.update(id, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.isPinned !== undefined && { isPinned: dto.isPinned }),
      ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      ...(dto.icon !== undefined && { icon: dto.icon }),
    })
    await this.cacheService.delByPrefix(`${KB_LIST_CACHE_PREFIX}${userId}`)
    return result
  }

  async remove(userId: string, id: string) {
    await this.ensureOwnership(userId, id)
    await this.eventEmitter.emitAsync(
      KnowledgeBaseDeletedEvent.eventType,
      new KnowledgeBaseDeletedEvent(id, userId),
    )
    await this.kbRepository.delete(id)
    await this.cacheService.delByPrefix(`${KB_LIST_CACHE_PREFIX}${userId}`)
    return { id, deleted: true }
  }

  async search(userId: string, kbId: string, query: string) {
    await this.ensureOwnership(userId, kbId)

    const trimmed = query.trim()
    if (!trimmed) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '搜索关键词不能为空',
      })
    }
    if (trimmed.length > MAX_SEARCH_QUERY_LENGTH) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `搜索关键词不能超过 ${MAX_SEARCH_QUERY_LENGTH} 个字符`,
      })
    }

    const [folders, documents] = await Promise.all([
      this.folderRepository.searchByKbName(kbId, trimmed, MAX_SEARCH_RESULTS),
      this.documentRepository.searchByKbName(kbId, trimmed, MAX_SEARCH_RESULTS),
    ])

    return { folders, documents }
  }

  private async ensureOwnership(userId: string, kbId: string) {
    const kb = await this.kbRepository.findById(kbId)

    if (!kb) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: '知识库不存在',
      })
    }

    if (kb.userId !== userId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '无权访问该资源',
      })
    }
  }
}
