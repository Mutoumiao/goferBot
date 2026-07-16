import { randomUUID } from 'node:crypto'
import {
  resolvePersonaPrompt,
  resolveUserSafety,
  WEB_COMPANION_OMIT_FIELDS,
} from '@goferbot/data/schemas'
import { BadRequestException, Injectable } from '@nestjs/common'
import type { Companion } from '@prisma/client'
import type { FastifyRequest } from 'fastify'
import sharp from 'sharp'
import { StorageService } from '../../processors/storage/storage.service.js'
import { SystemConfigService } from '../settings/system-config.service.js'
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

const DEFAULT_MAX_USER_COMPANIONS = 10

@Injectable()
export class CompanionService {
  constructor(
    private readonly companionRepo: CompanionRepository,
    private readonly storage: StorageService,
    private readonly systemConfig: SystemConfigService,
  ) {}

  async create(userId: string, dto: CreateCompanionDto) {
    const companionCfg = await this.getCompanionConfig()
    const max = companionCfg.maxUserCompanions ?? DEFAULT_MAX_USER_COMPANIONS
    const count = await this.companionRepo.countActiveUserCompanions(userId)
    if (count >= max) {
      throw new BadRequestException({
        code: 'COMPANION_LIMIT_EXCEEDED',
        message: `自定义伴侣数量已达上限（${max}）`,
      })
    }

    const safety = resolveUserSafety(companionCfg)
    const defaultPrompt = resolvePersonaPrompt(
      {
        source: 'user',
        name: dto.name,
        description: dto.description,
        personality: dto.personality,
        openingMessage: dto.openingMessage,
        boundaries: safety.boundaries,
        guardrailsPrompt: safety.guardrailsPrompt,
      },
      companionCfg,
    )

    const companion = await this.companionRepo.create({
      name: dto.name,
      description: dto.description,
      personality: dto.personality,
      openingMessage: dto.openingMessage,
      avatarKey: dto.avatarKey,
      defaultPrompt,
      source: 'user',
      status: 'published',
      visibility: 'private',
      lastAssistantMessage: dto.openingMessage ?? '',
      user: { connect: { id: userId } },
    })

    return this.toWebDto(companion)
  }

  async list(userId: string, query: CompanionListQueryDto) {
    const page = query.page ?? 1
    const size = query.size ?? 20
    const tab = query.tab ?? (query.source === 'system' ? 'official' : query.source === 'user' ? 'mine' : undefined)

    let result
    if (tab === 'official' || query.source === 'system') {
      result = await this.companionRepo.findOfficial({ page, size })
    } else if (tab === 'mine' || query.source === 'user' || !tab) {
      // 默认无 tab 时返回「我的」（兼容旧客户端）；官方列表须显式 tab=official
      // 产品默认 UI 在官方 Tab，由前端传 tab=official
      if (tab === 'mine' || query.source === 'user') {
        result = await this.companionRepo.findByUserId(userId, {
          status: query.status,
          page,
          size,
        })
      } else {
        // 无 tab：合并行为改为默认 official 以对齐产品；旧调用方用 mine 请传 tab=mine
        result = await this.companionRepo.findOfficial({ page, size })
      }
    } else {
      result = await this.companionRepo.findOfficial({ page, size })
    }

    return {
      items: result.data.map((c) => this.toWebDto(c)),
      pagination: result.pagination,
    }
  }

  async detail(userId: string, id: string) {
    const companion = await this.companionRepo.findByIdAndAuthorize(id, userId, 'read')
    return this.toWebDto(companion)
  }

  async update(userId: string, id: string, dto: UpdateCompanionDto) {
    const existing = await this.companionRepo.findByIdAndAuthorize(id, userId, 'write')
    const companionCfg = await this.getCompanionConfig()
    const safety = resolveUserSafety(companionCfg)

    const merged = {
      name: dto.name ?? existing.name,
      description: dto.description !== undefined ? dto.description : existing.description,
      personality: dto.personality !== undefined ? dto.personality : existing.personality,
      openingMessage:
        dto.openingMessage !== undefined ? dto.openingMessage : existing.openingMessage,
      // 保留未提交的扩展字段（headline/tone/story 等不主动清空）
      headline: existing.headline,
      backgroundStory: existing.backgroundStory,
      tone: existing.tone,
      avatarKey: dto.avatarKey !== undefined ? dto.avatarKey : existing.avatarKey,
    }

    const defaultPrompt = resolvePersonaPrompt(
      {
        source: 'user',
        ...merged,
        boundaries: safety.boundaries,
        guardrailsPrompt: safety.guardrailsPrompt,
      },
      companionCfg,
    )

    const updated = await this.companionRepo.update(id, {
      name: merged.name,
      description: merged.description,
      personality: merged.personality,
      openingMessage: merged.openingMessage,
      avatarKey: merged.avatarKey,
      defaultPrompt,
    })

    return this.toWebDto(updated)
  }

  async remove(userId: string, id: string) {
    await this.companionRepo.softDelete(id, userId)
    return { success: true }
  }

  async updateStatus(userId: string, id: string, dto: UpdateCompanionStatusDto) {
    await this.companionRepo.findByIdAndAuthorize(id, userId, 'write')
    const updated = await this.companionRepo.update(id, { status: dto.status })
    return this.toWebDto(updated)
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

  /** 运行时解析人设全文（chat pipeline 使用） */
  async resolvePromptForChat(companion: Companion): Promise<string> {
    const companionCfg = await this.getCompanionConfig()
    return resolvePersonaPrompt(
      {
        source: companion.source,
        name: companion.name,
        headline: companion.headline,
        description: companion.description,
        backgroundStory: companion.backgroundStory,
        personality: companion.personality,
        tone: companion.tone,
        boundaries: companion.boundaries,
        guardrailsPrompt: companion.guardrailsPrompt,
        openingMessage: companion.openingMessage,
      },
      companionCfg,
    )
  }

  private async getCompanionConfig() {
    try {
      return (await this.systemConfig.getSystemCategory('companion')) as {
        provider?: string
        defaultBoundaries?: string
        defaultGuardrailsPrompt?: string
        maxUserCompanions?: number
      }
    } catch {
      return {
        defaultBoundaries: '',
        defaultGuardrailsPrompt: '',
        maxUserCompanions: DEFAULT_MAX_USER_COMPANIONS,
      }
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

  /** Web 响应剥离 boundaries / guardrailsPrompt / defaultPrompt */
  toWebDto(companion: Companion) {
    const raw = { ...companion } as Record<string, unknown>
    for (const key of WEB_COMPANION_OMIT_FIELDS) {
      delete raw[key]
    }
    return {
      ...raw,
      avatarUrl: this.resolveAvatarUrl(companion.avatarKey),
    }
  }
}
