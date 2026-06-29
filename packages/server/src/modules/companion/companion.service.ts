import { Injectable } from '@nestjs/common'
import type {
  CompanionListQueryDto,
  CreateCompanionDto,
  UpdateCompanionDto,
  UpdateCompanionStatusDto,
} from './dto/companion.dto.js'
import { CompanionRepository } from './repositories/companion.repository.js'

@Injectable()
export class CompanionService {
  constructor(private readonly companionRepo: CompanionRepository) {}

  async create(userId: string, dto: CreateCompanionDto) {
    const companion = await this.companionRepo.create({
      ...dto,
      user: { connect: { id: userId } },
      status: 'draft',
      lastAssistantMessage: dto.openingMessage ?? '',
    })

    return {
      id: companion.id,
      name: companion.name,
      headline: companion.headline,
      status: companion.status,
      createdAt: companion.createdAt,
    }
  }

  async list(userId: string, query: CompanionListQueryDto) {
    const result = await this.companionRepo.findByUserId(userId, {
      status: query.status,
      page: query.page ?? 1,
      size: query.size ?? 20,
    })

    return { items: result.data, pagination: result.pagination }
  }

  async detail(userId: string, id: string) {
    return this.companionRepo.findByIdAndAuthorize(id, userId)
  }

  async update(userId: string, id: string, dto: UpdateCompanionDto) {
    await this.companionRepo.findByIdAndAuthorize(id, userId)
    return this.companionRepo.update(id, dto)
  }

  async remove(userId: string, id: string) {
    await this.companionRepo.softDelete(id, userId)
    return { success: true }
  }

  async updateStatus(userId: string, id: string, dto: UpdateCompanionStatusDto) {
    await this.companionRepo.findByIdAndAuthorize(id, userId)
    return this.companionRepo.update(id, { status: dto.status })
  }
}
