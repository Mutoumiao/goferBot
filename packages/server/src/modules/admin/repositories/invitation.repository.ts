import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../processors/database/prisma.service.js'

export interface InvitationCodeRecord {
  id: string
  code: string
  type: string
  maxUses: number | null
  useCount: number
  note: string | null
  expiresAt: string | null
  isExpired: boolean
  isRevoked: boolean
  isActive: boolean
  createdAt: string
  creatorName: string | null
  usedByUserEmail: string | null
}

@Injectable()
export class InvitationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: {
    page: number
    pageSize: number
    type?: string
    active?: boolean
  }): Promise<{ items: InvitationCodeRecord[]; total: number; page: number; pageSize: number }> {
    const { page, pageSize, type, active } = query
    const take = pageSize
    const skip = (page - 1) * take
    const now = new Date()

    const where: Record<string, unknown> = {}
    if (type) where.type = type
    if (active !== undefined) {
      if (active) {
        where.AND = [
          {
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          {
            OR: [{ type: 'standard', usedBy: null }, { type: 'multi' }],
          },
        ]
      } else {
        where.OR = [{ expiresAt: { lt: now } }, { type: 'standard', usedBy: { not: null } }]
      }
    }

    const [total, records] = (await this.prisma.$transaction([
      this.prisma.invitationCode.count({ where }),
      (this.prisma.invitationCode as any).findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          creator: { select: { name: true, email: true } },
          registeredUsers: { select: { email: true }, take: 1 },
        },
      }),
    ])) as [
      number,
      Array<{
        id: string
        code: string
        type: string
        maxUses: number | null
        usedCount: number
        note: string | null
        expiresAt: Date | null
        createdAt: Date
        creator: { name: string | null; email: string } | null
        registeredUsers: Array<{ email: string }>
      }>,
    ]

    const items: InvitationCodeRecord[] = records.map((r) => {
      const isExpired = r.expiresAt !== null && r.expiresAt < now
      const isUsedUp =
        r.type === 'standard' ? r.usedCount >= 1 : r.maxUses !== null && r.usedCount >= r.maxUses
      const isActive = !isExpired && !isUsedUp

      return {
        id: r.id,
        code: r.code,
        type: r.type,
        maxUses: r.maxUses,
        useCount: r.usedCount,
        note: r.note,
        expiresAt: r.expiresAt?.toISOString() ?? null,
        isExpired,
        isRevoked: false,
        isActive,
        createdAt: r.createdAt.toISOString(),
        creatorName: r.creator?.name ?? r.creator?.email ?? null,
        usedByUserEmail: r.registeredUsers[0]?.email ?? null,
      }
    })

    return { items, total, page, pageSize: take }
  }

  async findByCode(code: string) {
    return this.prisma.invitationCode.findUnique({ where: { code } })
  }

  async findById(id: string) {
    return this.prisma.invitationCode.findUnique({ where: { id } })
  }

  async create(data: {
    code: string
    type: 'standard' | 'multi'
    maxUses?: number | null
    note?: string | null
    expiresAt?: Date | null
    createdBy: string
  }) {
    return this.prisma.invitationCode.create({ data })
  }

  async revoke(id: string) {
    return this.prisma.invitationCode.update({
      where: { id },
      data: { expiresAt: new Date() },
    })
  }

  async delete(id: string) {
    await this.prisma.invitationCode.delete({ where: { id } })
  }
}
