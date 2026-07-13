import { Injectable } from '@nestjs/common'
import type { CompanionCareEvent, CompanionCarePlan, Prisma } from '@prisma/client'
import { PrismaService } from '../../../processors/database/prisma.service.js'

@Injectable()
export class CompanionCareRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findPlan(userId: string, companionId: string): Promise<CompanionCarePlan | null> {
    return this.prisma.companionCarePlan.findUnique({
      where: { userId_companionId: { userId, companionId } },
    })
  }

  async upsertPlan(
    userId: string,
    companionId: string,
    data: {
      enabled: boolean
      frequency: 'daily' | 'weekly' | 'monthly' | 'custom'
      preferredTime?: string | null
      scenesJson: string
      tone: string
      customPrompt?: string | null
      nextRunAtMs?: bigint | null
    },
  ): Promise<CompanionCarePlan> {
    return this.prisma.companionCarePlan.upsert({
      where: { userId_companionId: { userId, companionId } },
      create: {
        userId,
        companionId,
        enabled: data.enabled,
        frequency: data.frequency,
        preferredTime: data.preferredTime ?? null,
        scenesJson: data.scenesJson,
        tone: data.tone,
        customPrompt: data.customPrompt ?? null,
        nextRunAtMs: data.nextRunAtMs ?? null,
      },
      update: {
        enabled: data.enabled,
        frequency: data.frequency,
        preferredTime: data.preferredTime ?? null,
        scenesJson: data.scenesJson,
        tone: data.tone,
        customPrompt: data.customPrompt ?? null,
        nextRunAtMs: data.nextRunAtMs ?? null,
      },
    })
  }

  async createEvent(data: Prisma.CompanionCareEventCreateInput): Promise<CompanionCareEvent> {
    return this.prisma.companionCareEvent.create({ data })
  }
}
