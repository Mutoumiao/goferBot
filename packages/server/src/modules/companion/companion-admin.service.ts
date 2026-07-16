import { randomUUID } from 'node:crypto'
import { buildDefaultAgentPrompt } from '@goferbot/data/schemas'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import sharp from 'sharp'
import { StorageService } from '../../processors/storage/storage.service.js'
import type {
  CreateAdminCompanionDto,
  UpdateAdminCompanionDto,
  UpdateCompanionStatusDto,
} from './dto/companion.dto.js'
import {
  COMPANION_AVATAR_MAX_BYTES,
  validateCompanionAvatarMeta,
} from './persona/avatar-validation.js'
import { CompanionRepository } from './repositories/companion.repository.js'

@Injectable()
export class CompanionAdminService {
  constructor(
    private readonly companionRepo: CompanionRepository,
    private readonly storage: StorageService,
  ) {}

  async list(query: { status?: 'draft' | 'published' | 'archived'; page?: number; size?: number }) {
    const result = await this.companionRepo.findSystemMany({
      status: query.status,
      page: query.page ?? 1,
      size: query.size ?? 20,
    })
    return {
      items: result.data.map((c) => this.withAvatarUrl(c)),
      pagination: result.pagination,
    }
  }

  async detail(id: string) {
    const companion = await this.companionRepo.findSystemById(id)
    if (!companion) throw new NotFoundException('内置伴侣不存在')
    return this.withAvatarUrl(companion)
  }

  async create(dto: CreateAdminCompanionDto) {
    const defaultPrompt =
      dto.defaultPrompt?.trim() ||
      buildDefaultAgentPrompt({
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
      name: dto.name,
      headline: dto.headline,
      description: dto.description,
      personality: dto.personality,
      tone: dto.tone,
      boundaries: dto.boundaries,
      guardrailsPrompt: dto.guardrailsPrompt,
      backgroundStory: dto.backgroundStory,
      openingMessage: dto.openingMessage,
      avatarKey: dto.avatarKey,
      visibility: dto.visibility ?? 'public',
      defaultPrompt,
      source: 'system',
      status: dto.status ?? 'draft',
      lastAssistantMessage: dto.openingMessage ?? '',
      // userId 省略 → null
    })

    return this.withAvatarUrl(companion)
  }

  async update(id: string, dto: UpdateAdminCompanionDto) {
    const existing = await this.companionRepo.findSystemById(id)
    if (!existing) throw new NotFoundException('内置伴侣不存在')

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
      avatarKey: dto.avatarKey !== undefined ? dto.avatarKey : existing.avatarKey,
      visibility: dto.visibility !== undefined ? dto.visibility : existing.visibility,
    }

    const defaultPrompt =
      dto.defaultPrompt?.trim() ||
      buildDefaultAgentPrompt({
        name: merged.name,
        headline: merged.headline,
        description: merged.description,
        backgroundStory: merged.backgroundStory,
        personality: merged.personality,
        tone: merged.tone,
        boundaries: merged.boundaries,
        guardrailsPrompt: merged.guardrailsPrompt,
        openingMessage: merged.openingMessage,
      })

    const updated = await this.companionRepo.update(id, {
      ...merged,
      defaultPrompt,
      ...(dto.status ? { status: dto.status } : {}),
    })

    return this.withAvatarUrl(updated)
  }

  async updateStatus(id: string, dto: UpdateCompanionStatusDto) {
    const existing = await this.companionRepo.findSystemById(id)
    if (!existing) throw new NotFoundException('内置伴侣不存在')
    const updated = await this.companionRepo.update(id, { status: dto.status })
    return this.withAvatarUrl(updated)
  }

  /** 归档内置伴侣（禁止硬删） */
  async archive(id: string) {
    return this.updateStatus(id, { status: 'archived' })
  }

  async uploadAvatar(req: FastifyRequest) {
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
    const key = `companions/system/${Date.now()}-${randomUUID()}.${ext}`
    await this.storage.uploadFile(buffer, key, data.mimetype)

    return {
      avatarKey: key,
      avatarUrl: this.storage.getUrl(key),
      width,
      height,
    }
  }

  private resolveAvatarUrl(avatarKey: string | null | undefined): string | null {
    if (!avatarKey) return null
    try {
      return this.storage.getUrl(avatarKey)
    } catch {
      return null
    }
  }

  private withAvatarUrl<T extends { avatarKey?: string | null }>(companion: T) {
    return {
      ...companion,
      avatarUrl: this.resolveAvatarUrl(companion.avatarKey),
    }
  }
}
