import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common'
import { PrismaService } from '../../processors/database/prisma.service.js'
import type { Paginator } from '../../shared/interfaces/paginator.interface.js'
import type { CreateSessionDto } from './dto/create-session.dto.js'
import type { UpdateSessionDto } from './dto/update-session.dto.js'

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    userId: string,
    query: { page?: number; limit?: number } = {},
  ): Promise<{
    items: Array<{
      id: string
      userId: string
      title: string
      provider: string | null
      model: string | null
      createdAt: Date
      updatedAt: Date
      messageCount: number
    }>
    pagination: Paginator
  }> {
    const page = query.page ?? 1
    const limit = query.limit ?? 50

    const result = await (this.prisma.session as any).paginate(
      {
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        include: {
          _count: {
            select: { messages: true },
          },
        },
      },
      { page, size: limit },
    )

    return {
      items: result.data.map((session: any) => ({
        id: session.id,
        userId: session.userId,
        title: session.title,
        provider: session.provider,
        model: session.model,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        messageCount: session._count.messages,
      })),
      pagination: result.pagination,
    }
  }

  async findOne(userId: string, id: string) {
    const session = await this.prisma.session.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    })

    if (!session) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: '会话不存在',
      })
    }

    if (session.userId !== userId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '无权访问该资源',
      })
    }

    return session
  }

  async create(userId: string, dto: CreateSessionDto) {
    return this.prisma.session.create({
      data: {
        userId,
        title: dto.title ?? '新对话',
        provider: dto.provider ?? null,
        model: dto.model ?? null,
      },
    })
  }

  async update(userId: string, id: string, dto: UpdateSessionDto) {
    await this.ensureOwnership(userId, id)

    return this.prisma.session.update({
      where: { id },
      data: { title: dto.title },
    })
  }

  async remove(userId: string, id: string) {
    await this.ensureOwnership(userId, id)
    await this.prisma.session.delete({ where: { id } })
    return { id, deleted: true }
  }

  async listMessages(
    userId: string,
    sessionId: string,
    query: { page?: number; limit?: number } = {},
  ) {
    await this.ensureOwnership(userId, sessionId)

    const page = query.page ?? 1
    const limit = query.limit ?? 50
    const skip = (page - 1) * limit

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.message.count({ where: { sessionId } }),
    ])

    return {
      messages: messages.map((m: any) => ({
        id: m.id,
        sessionId: m.sessionId,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })),
      total,
      hasMore: skip + messages.length < total,
    }
  }

  private async ensureOwnership(userId: string, id: string) {
    const session = await this.prisma.session.findUnique({
      where: { id },
      select: { userId: true },
    })

    if (!session) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: '会话不存在',
      })
    }

    if (session.userId !== userId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '无权访问该资源',
      })
    }
  }
}
