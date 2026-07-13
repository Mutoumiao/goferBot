import { BadRequestException, Injectable } from '@nestjs/common'
import type { GenerateCareEventDto, UpdateCarePlanDto } from './dto/companion.dto.js'
import {
  buildProactiveCareMessage,
  type CareScene,
  type CareTone,
  calculateNextCareRunAtMs,
} from './persona/care-message-templates.js'
import { CompanionRepository } from './repositories/companion.repository.js'
import { CompanionCareRepository } from './repositories/companion-care.repository.js'
import { CompanionConversationRepository } from './repositories/companion-conversation.repository.js'
import { CompanionMessageRepository } from './repositories/companion-message.repository.js'

const DEFAULT_SCENES: CareScene[] = ['morning', 'night']
const DEFAULT_TONE: CareTone = 'gentle'
const DEFAULT_FREQUENCY = 'daily' as const

@Injectable()
export class CompanionCareService {
  constructor(
    private readonly companionRepo: CompanionRepository,
    private readonly careRepo: CompanionCareRepository,
    private readonly conversationRepo: CompanionConversationRepository,
    private readonly messageRepo: CompanionMessageRepository,
  ) {}

  /**
   * GET：无行返回未持久化默认，不插库。
   */
  async getPlan(userId: string, companionId: string) {
    await this.companionRepo.findByIdAndAuthorize(companionId, userId)
    const row = await this.careRepo.findPlan(userId, companionId)
    if (!row) {
      return {
        companionId,
        enabled: true,
        frequency: DEFAULT_FREQUENCY,
        preferredTime: null,
        scenes: DEFAULT_SCENES,
        tone: DEFAULT_TONE,
        customPrompt: null,
        nextRunAtMs: null,
        isDefault: true,
      }
    }
    return this.mapPlan(row)
  }

  async updatePlan(userId: string, companionId: string, dto: UpdateCarePlanDto) {
    await this.companionRepo.findByIdAndAuthorize(companionId, userId)
    const existing = await this.careRepo.findPlan(userId, companionId)

    const enabled = dto.enabled ?? existing?.enabled ?? true
    const frequency = dto.frequency ?? existing?.frequency ?? DEFAULT_FREQUENCY
    const preferredTime =
      dto.preferredTime !== undefined ? dto.preferredTime : (existing?.preferredTime ?? null)
    const scenes = dto.scenes ?? this.parseScenes(existing?.scenesJson) ?? DEFAULT_SCENES
    const tone = (dto.tone ?? existing?.tone ?? DEFAULT_TONE) as CareTone
    const customPrompt =
      dto.customPrompt !== undefined ? dto.customPrompt : (existing?.customPrompt ?? null)

    const nextRunAtMs = calculateNextCareRunAtMs({
      enabled,
      frequency,
      preferredTime,
    })

    const row = await this.careRepo.upsertPlan(userId, companionId, {
      enabled,
      frequency: frequency as 'daily' | 'weekly' | 'monthly' | 'custom',
      preferredTime: preferredTime as string | null,
      scenesJson: JSON.stringify(scenes),
      tone: String(tone),
      customPrompt: customPrompt as string | null,
      nextRunAtMs: nextRunAtMs != null ? BigInt(nextRunAtMs) : null,
    })

    return this.mapPlan(row)
  }

  /**
   * 手动生成关怀：模板文案 → 会话助手消息 + CareEvent（不经 11 节点）。
   * 无 Cron 路径。
   */
  async generate(userId: string, companionId: string, dto: GenerateCareEventDto) {
    const companion = await this.companionRepo.findByIdAndAuthorize(companionId, userId)
    if (companion.status === 'archived') {
      throw new BadRequestException({
        code: 'ERR_COMPANION_ARCHIVED',
        message: '该伴侣已归档，无法生成关怀消息',
      })
    }
    const planRow = await this.careRepo.findPlan(userId, companionId)
    const scenes = this.parseScenes(planRow?.scenesJson) ?? DEFAULT_SCENES
    const scene = (dto.scene ?? scenes[0] ?? 'morning') as CareScene
    const tone = (dto.tone ?? planRow?.tone ?? DEFAULT_TONE) as CareTone
    const customPrompt =
      dto.customPrompt !== undefined ? dto.customPrompt : (planRow?.customPrompt ?? null)

    const messageText = buildProactiveCareMessage({
      scene,
      tone,
      companionName: companion.name,
      customPrompt,
    })

    const conversation = await this.conversationRepo.getOrCreate(undefined, userId, companionId)
    const metadata = JSON.stringify({ care: { scene } })

    const assistantMsg = await this.messageRepo.save({
      conversationId: conversation.id,
      userId,
      companionId,
      role: 'assistant',
      content: messageText,
      metadata,
    })

    await this.conversationRepo.incrementMessageCount(conversation.id)

    await this.companionRepo.update(companionId, {
      lastAssistantMessage: messageText,
      lastAssistantMessageAtMs: BigInt(Date.now()),
    })

    const event = await this.careRepo.createEvent({
      user: { connect: { id: userId } },
      companion: { connect: { id: companionId } },
      conversation: { connect: { id: conversation.id } },
      carePlanId: planRow?.id,
      messageId: assistantMsg.id,
      scene: String(scene),
      status: 'sent',
      message: messageText,
      metadataJson: metadata,
      generatedAtMs: BigInt(Date.now()),
    })

    return {
      id: event.id,
      companionId,
      conversationId: conversation.id,
      messageId: assistantMsg.id,
      scene: event.scene,
      status: event.status,
      message: event.message,
      generatedAtMs: Number(event.generatedAtMs),
    }
  }

  private mapPlan(row: {
    id: string
    companionId: string
    enabled: boolean
    frequency: string
    preferredTime: string | null
    scenesJson: string
    tone: string
    customPrompt: string | null
    nextRunAtMs: bigint | null
  }) {
    return {
      id: row.id,
      companionId: row.companionId,
      enabled: row.enabled,
      frequency: row.frequency,
      preferredTime: row.preferredTime,
      scenes: this.parseScenes(row.scenesJson) ?? DEFAULT_SCENES,
      tone: row.tone,
      customPrompt: row.customPrompt,
      nextRunAtMs: row.nextRunAtMs != null ? Number(row.nextRunAtMs) : null,
      isDefault: false,
    }
  }

  private parseScenes(json?: string | null): CareScene[] | null {
    if (!json) return null
    try {
      const parsed = JSON.parse(json) as unknown
      if (Array.isArray(parsed) && parsed.every((s) => typeof s === 'string')) {
        return parsed as CareScene[]
      }
    } catch {
      /* ignore */
    }
    return null
  }
}
