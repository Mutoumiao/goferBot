import { randomUUID } from 'node:crypto'
import { buildDefaultAgentPrompt } from '@goferbot/data/schemas'
import { BadRequestException, Injectable } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import sharp from 'sharp'
import { StorageService } from '../../processors/storage/storage.service.js'
import type {
  CompanionListQueryDto,
  CreateCompanionDto,
  UpdateCompanionDto,
  UpdateCompanionStatusDto,
} from './dto/companion.dto.js'
import {
  COMPANION_AVATAR_MAX_BYTES,
  validateCompanionAvatarMeta,
} from './persona/avatar-validation.js'
import { CompanionRepository } from './repositories/companion.repository.js'

@Injectable()
export class CompanionService {
  constructor(
    private readonly companionRepo: CompanionRepository,
    private readonly storage: StorageService,
  ) {}

  async create(userId: string, dto: CreateCompanionDto) {
    const defaultPrompt = buildDefaultAgentPrompt({
      name: dto.name,
      headline: dto.headline,
      description: dto.description,
      backgroundStory: dto.backgroundStory,
      personality: dto.personality,
      tone: dto.tone,
      boundaries: dto.boundaries,
      guardrailsPrompt: dto.guardrailsPrompt,
      openingMessage: dto.openingMessage,
    })

    const companion = await this.companionRepo.create({
      ...dto,
      defaultPrompt,
      user: { connect: { id: userId } },
      status: 'draft',
      lastAssistantMessage: dto.openingMessage ?? '',
    })

    return {
      id: companion.id,
      name: companion.name,
      headline: companion.headline,
      status: companion.status,
      defaultPrompt: companion.defaultPrompt,
      avatarKey: companion.avatarKey,
      createdAt: companion.createdAt,
    }
  }

  async list(userId: string, query: CompanionListQueryDto) {
    const result = await this.companionRepo.findByUserId(userId, {
      status: query.status,
      page: query.page ?? 1,
      size: query.size ?? 20,
    })

    return {
      items: result.data.map((c) => this.withAvatarUrl(c)),
      pagination: result.pagination,
    }
  }

  async detail(userId: string, id: string) {
    const companion = await this.companionRepo.findByIdAndAuthorize(id, userId)
    return this.withAvatarUrl(companion)
  }

  /** 将 avatarKey 解析为可访问 URL（MinIO getUrl）；未配置存储时返回 null */
  private resolveAvatarUrl(avatarKey: string | null | undefined): string | null {
    if (!avatarKey) return null
    try {
      return this.storage.getUrl(avatarKey)
    } catch {
      return null
    }
  }

  private withAvatarUrl<T extends { avatarKey?: string | null }>(
    companion: T,
  ): T & { avatarUrl: string | null } {
    return {
      ...companion,
      avatarUrl: this.resolveAvatarUrl(companion.avatarKey),
    }
  }

  async update(userId: string, id: string, dto: UpdateCompanionDto) {
    const existing = await this.companionRepo.findByIdAndAuthorize(id, userId)
    const merged = {
      name: dto.name ?? existing.name,
      headline: dto.headline !== undefined ? dto.headline : existing.headline,
      description: dto.description !== undefined ? dto.description : existing.description,
      backgroundStory:
        dto.backgroundStory !== undefined ? dto.backgroundStory : existing.backgroundStory,
      personality: dto.personality !== undefined ? dto.personality : existing.personality,
      tone: dto.tone !== undefined ? dto.tone : existing.tone,
      boundaries: dto.boundaries !== undefined ? dto.boundaries : existing.boundaries,
      guardrailsPrompt:
        dto.guardrailsPrompt !== undefined ? dto.guardrailsPrompt : existing.guardrailsPrompt,
      openingMessage:
        dto.openingMessage !== undefined ? dto.openingMessage : existing.openingMessage,
    }

    const defaultPrompt = buildDefaultAgentPrompt(merged)

    return this.companionRepo.update(id, {
      ...dto,
      defaultPrompt,
    })
  }

  async remove(userId: string, id: string) {
    await this.companionRepo.softDelete(id, userId)
    return { success: true }
  }

  async updateStatus(userId: string, id: string, dto: UpdateCompanionStatusDto) {
    await this.companionRepo.findByIdAndAuthorize(id, userId)
    return this.companionRepo.update(id, { status: dto.status })
  }

  /**
   * 伴侣头像上传：校验 MIME/大小/尺寸后写入 MinIO，返回 avatarKey。
   */
  async uploadAvatar(userId: string, req: FastifyRequest) {
    const data = await req.file()
    if (!data) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '请上传头像文件' })
    }

    const chunks: Buffer[] = []
    let total = 0
    for await (const chunk of data.file) {
      total += (chunk as Buffer).length
      if (total > COMPANION_AVATAR_MAX_BYTES) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: '头像文件大小不能超过 5MB',
        })
      }
      chunks.push(chunk as Buffer)
    }
    const buffer = Buffer.concat(chunks)

    let width = 0
    let height = 0
    try {
      const meta = await sharp(buffer).metadata()
      width = meta.width ?? 0
      height = meta.height ?? 0
    } catch {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '无法解析图片' })
    }

    const check = validateCompanionAvatarMeta({
      mimeType: data.mimetype,
      sizeBytes: buffer.length,
      width,
      height,
    })
    if (!check.ok) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: check.message })
    }

    const ext =
      data.mimetype === 'image/png' ? 'png' : data.mimetype === 'image/webp' ? 'webp' : 'jpg'
    const key = `companions/${userId}/${Date.now()}-${randomUUID()}.${ext}`
    await this.storage.uploadFile(buffer, key, data.mimetype)

    return {
      avatarKey: key,
      avatarUrl: this.storage.getUrl(key),
      width,
      height,
    }
  }
}
