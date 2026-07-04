import { randomBytes } from 'node:crypto'
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { InvitationRepository } from '../repositories/invitation.repository.js'

function generateCode(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(length)
  let code = ''
  for (let i = 0; i < length; i++) {
    code += chars[bytes[i] % chars.length]
  }
  return code
}

@Injectable()
export class InvitationService {
  constructor(private readonly invitationRepository: InvitationRepository) {}

  async list(query: { page?: number; pageSize?: number; type?: string; active?: boolean }) {
    const page = query.page ?? 1
    const pageSize = Math.min(query.pageSize ?? 20, 100)
    return this.invitationRepository.list({
      page,
      pageSize,
      type: query.type,
      active: query.active,
    })
  }

  async create(data: {
    type?: 'standard' | 'multi'
    maxUses?: number
    note?: string
    expiresAt?: string
    createdBy: string
  }) {
    const code = generateCode()
    const type = data.type ?? 'standard'
    const maxUses = data.type === 'multi' ? (data.maxUses ?? null) : 1
    const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null

    return this.invitationRepository.create({
      code,
      type,
      maxUses,
      note: data.note ?? null,
      expiresAt,
      createdBy: data.createdBy,
    })
  }

  async revoke(id: string) {
    const existing = await this.invitationRepository.findById(id)
    if (!existing) {
      throw new NotFoundException({ code: 'INVITATION_NOT_FOUND', message: '邀请码不存在' })
    }
    const isUsedUp =
      existing.type === 'standard'
        ? existing.usedCount >= 1
        : existing.maxUses !== null && existing.usedCount >= existing.maxUses
    if (isUsedUp) {
      throw new ForbiddenException({
        code: 'INVITATION_ALREADY_USED',
        message: '已用完的邀请码无法撤销',
      })
    }
    if (existing.expiresAt && existing.expiresAt < new Date()) {
      throw new ForbiddenException({
        code: 'INVITATION_EXPIRED',
        message: '已过期的邀请码无法撤销',
      })
    }
    await this.invitationRepository.revoke(id)
    return { success: true }
  }

  async delete(id: string) {
    const existing = await this.invitationRepository.findById(id)
    if (!existing) {
      throw new NotFoundException({ code: 'INVITATION_NOT_FOUND', message: '邀请码不存在' })
    }
    if (existing.usedCount > 0) {
      throw new ForbiddenException({
        code: 'INVITATION_ALREADY_USED',
        message: '已使用的邀请码无法删除',
      })
    }
    await this.invitationRepository.delete(id)
    return { success: true }
  }
}
