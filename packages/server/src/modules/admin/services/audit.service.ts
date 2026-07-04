import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../processors/database/prisma.service.js'

export type AuditOperation =
  | 'user.create'
  | 'user.update'
  | 'user.update_status'
  | 'user.assign_role'
  | 'user.remove_role'
  | 'user.delete'
  | 'user.reset_password'
  | 'role.create'
  | 'role.update'
  | 'role.delete'
  | 'role.assign_permissions'
  | 'invitation.create'
  | 'invitation.revoke'
  | 'invitation.delete'

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    actor: string
    operation: AuditOperation
    target: string
    targetId?: string
    result?: 'success' | 'failure'
    metadata?: Record<string, unknown>
  }) {
    await (this.prisma.adminAuditLog as any).create({
      data: {
        actor: params.actor,
        operation: params.operation,
        target: params.target,
        targetId: params.targetId,
        result: params.result ?? 'success',
        metadata: params.metadata ?? undefined,
      },
    })
  }

  async list(query: { page?: number; pageSize?: number; operation?: string; actor?: string }) {
    const page = query.page ?? 1
    const pageSize = Math.min(query.pageSize ?? 20, 100)
    const take = pageSize
    const skip = (page - 1) * take

    const where: Record<string, unknown> = {}
    if (query.operation) where.operation = query.operation
    if (query.actor) where.actor = query.actor

    const [total, items] = await this.prisma.$transaction([
      (this.prisma.adminAuditLog as any).count({ where }),
      (this.prisma.adminAuditLog as any).findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ])

    return { items, total, page, pageSize: take }
  }
}
