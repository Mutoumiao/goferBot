import { Controller, Get, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../../auth/guards/jwt.guard.js'
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js'
import { PrismaService } from '../../processors/database/prisma.service.js'
import { ModelRegistryService } from './model-registry.service.js'

interface KnowledgeBaseListItem {
  id: string
  name: string
  fileCount: number
}

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatInitController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly modelRegistry: ModelRegistryService,
  ) {}

  @Get('providers')
  async providers() {
    return {
      providers: this.modelRegistry.list(),
    }
  }

  @Get('knowledge-bases')
  async knowledgeBases(@CurrentUser('id') userId: string) {
    const kbRows = await this.prisma.knowledgeBase.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        _count: { select: { documents: true } },
      },
    })

    const knowledgeBases: KnowledgeBaseListItem[] = kbRows.map((kb) => ({
      id: kb.id,
      name: kb.name,
      fileCount: kb._count.documents,
    }))

    return { knowledgeBases }
  }

  @Get('init')
  async init(@CurrentUser('id') userId: string) {
    const providersRes = await this.providers()
    const kbRes = await this.knowledgeBases(userId)
    return {
      ...providersRes,
      ...kbRes,
    }
  }
}
