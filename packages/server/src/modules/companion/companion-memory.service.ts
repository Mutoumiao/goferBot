import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import type { MemoryListQueryDto, UpdateMemoryDto } from './dto/companion.dto.js'
import { CompanionRepository } from './repositories/companion.repository.js'
import { CompanionMemoryRepository } from './repositories/companion-memory.repository.js'

@Injectable()
export class CompanionMemoryService {
  constructor(
    private readonly companionRepo: CompanionRepository,
    private readonly memoryRepo: CompanionMemoryRepository,
  ) {}

  async list(userId: string, query: MemoryListQueryDto) {
    if (!query.companionId) {
      throw new NotFoundException('companionId is required')
    }
    await this.companionRepo.findByIdAndAuthorize(query.companionId, userId)

    const result = await this.memoryRepo.findByCompanionAndUser(query.companionId, userId, {
      page: query.page ?? 1,
      size: query.size ?? 20,
      status: query.status,
      type: query.type,
    })

    return { items: result.data, pagination: result.pagination }
  }

  async update(userId: string, memoryId: string, dto: UpdateMemoryDto) {
    const memory = await this.memoryRepo.findById(memoryId)
    if (!memory || memory.status === 'deleted') {
      throw new NotFoundException('记忆不存在')
    }
    if (memory.userId !== userId) {
      throw new ForbiddenException('无权修改此记忆')
    }
    await this.companionRepo.findByIdAndAuthorize(memory.companionId, userId)

    const updated = await this.memoryRepo.update(memoryId, {
      ...(dto.content !== undefined ? { content: dto.content } : {}),
      ...(dto.importance !== undefined ? { importance: dto.importance } : {}),
      ...(dto.type !== undefined ? { type: dto.type } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
    })

    return updated
  }

  async remove(userId: string, memoryId: string) {
    const memory = await this.memoryRepo.findById(memoryId)
    if (!memory || memory.status === 'deleted') {
      throw new NotFoundException('记忆不存在')
    }
    if (memory.userId !== userId) {
      throw new ForbiddenException('无权删除此记忆')
    }
    await this.companionRepo.findByIdAndAuthorize(memory.companionId, userId)

    // 软删除：status=deleted
    await this.memoryRepo.update(memoryId, { status: 'deleted' })
    return { success: true }
  }
}
