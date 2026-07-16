import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../../processors/database/prisma.service.js'

export const COMPANION_OBS_SAFETY_HARD_STOP = 'safety_hard_stop'

export interface CreateSafetyHardStopEventInput {
  companionId: string
  conversationId?: string
  userId?: string
  boundaryAction?: string
  reason?: string
}

/**
 * Companion 观测侧信道：硬中断等不落助手消息的事件。
 */
@Injectable()
export class CompanionObsEventRepository {
  private readonly logger = new Logger(CompanionObsEventRepository.name)

  constructor(private readonly prisma: PrismaService) {}

  async recordSafetyHardStop(input: CreateSafetyHardStopEventInput): Promise<void> {
    try {
      await this.prisma.companionObsEvent.create({
        data: {
          type: COMPANION_OBS_SAFETY_HARD_STOP,
          companionId: input.companionId,
          conversationId: input.conversationId,
          userId: input.userId,
          boundaryAction: input.boundaryAction,
          reason: input.reason?.slice(0, 500),
        },
      })
    } catch (err) {
      // 观测不得拖垮主路径
      this.logger.error(
        `recordSafetyHardStop failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }
}
