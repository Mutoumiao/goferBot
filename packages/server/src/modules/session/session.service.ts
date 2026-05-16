import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common'
import { PrismaService } from '../../processors/database/prisma.service.js'
import type { CreateSessionDto } from './dto/create-session.dto.js'
import type { UpdateSessionDto } from './dto/update-session.dto.js'

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const sessions = await this.prisma.session.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { messages: true },
        },
      },
    })

    return sessions.map((session) => ({
      id: session.id,
      userId: session.userId,
      title: session.title,
      provider: session.provider,
      model: session.model,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messageCount: session._count.messages,
    }))
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
