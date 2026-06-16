import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../../auth/guards/jwt.guard.js'
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js'
import { KnowledgeBaseService } from './knowledge-base.service.js'
import { FolderService } from './folder.service.js'
import { CreateKbDto } from './dto/create-kb.dto.js'
import { UpdateKbDto } from './dto/update-kb.dto.js'

@Controller('knowledge-bases')
@UseGuards(JwtAuthGuard)
export class KnowledgeBaseController {
  constructor(
    private readonly kbService: KnowledgeBaseService,
    private readonly folderService: FolderService,
  ) {}

  @Get()
  async list(@CurrentUser('id') userId: string) {
    const entries = await this.kbService.list(userId)
    return {
      items: entries,
      pagination: {
        total: entries.length,
        size: entries.length,
        currentPage: 1,
        totalPage: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    }
  }

  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateKbDto,
  ) {
    return this.kbService.create(userId, dto)
  }

  @Patch(':id')
  async update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateKbDto,
  ) {
    return this.kbService.update(userId, id, dto)
  }

  @Delete(':id')
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.kbService.remove(userId, id)
  }

  @Get(':kbId/breadcrumbs')
  async breadcrumbs(
    @CurrentUser('id') userId: string,
    @Param('kbId') kbId: string,
    @Query('folderId') folderId?: string,
  ) {
    return this.folderService.getBreadcrumbs(userId, kbId, folderId)
  }

  @Get(':kbId/search')
  async search(
    @CurrentUser('id') userId: string,
    @Param('kbId') kbId: string,
    @Query('q') query?: string,
  ) {
    const q = (query ?? '').trim()
    if (!q) {
      return { folders: [], documents: [] }
    }
    return this.kbService.search(userId, kbId, q)
  }
}
