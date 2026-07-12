import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js'
import { JwtAuthGuard } from '../../auth/guards/jwt.guard.js'
import { CreateKbDto } from './dto/create-kb.dto.js'
import { UpdateKbDto } from './dto/update-kb.dto.js'
import { FolderService } from './folder.service.js'
import { KnowledgeBaseService } from './knowledge-base.service.js'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function validateUuid(value: string, fieldName: string): void {
  if (!UUID_REGEX.test(value)) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: `${fieldName} 格式不正确，应为 UUID`,
    })
  }
}

@Controller('knowledge-bases')
@UseGuards(JwtAuthGuard)
export class KnowledgeBaseController {
  constructor(
    private readonly kbService: KnowledgeBaseService,
    private readonly folderService: FolderService,
  ) {}

  @Get()
  async list(
    @CurrentUser('id') userId: string,
    @Query('page') pageStr?: string,
    @Query('size') sizeStr?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr || '1', 10) || 1)
    const size = Math.max(1, Math.min(100, parseInt(sizeStr || '20', 10) || 20))

    const { items, total } = await this.kbService.list(userId, page, size)
    const totalPage = Math.ceil(total / size) || 1

    return {
      items,
      pagination: {
        total,
        size,
        currentPage: page,
        totalPage,
        hasNextPage: page < totalPage,
        hasPrevPage: page > 1,
      },
    }
  }

  @Get('for-selector')
  async forSelector(@CurrentUser('id') userId: string) {
    return this.kbService.listForSelector(userId)
  }

  @Post()
  async create(@CurrentUser('id') userId: string, @Body() dto: CreateKbDto) {
    return this.kbService.create(userId, dto)
  }

  @Patch(':id')
  async update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateKbDto,
  ) {
    validateUuid(id, 'id')
    return this.kbService.update(userId, id, dto)
  }

  @Delete(':id')
  async remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    validateUuid(id, 'id')
    return this.kbService.remove(userId, id)
  }

  @Get(':kbId/breadcrumbs')
  async breadcrumbs(
    @CurrentUser('id') userId: string,
    @Param('kbId') kbId: string,
    @Query('folderId') folderId?: string,
  ) {
    validateUuid(kbId, 'kbId')
    // 根目录：缺省或空串均视为无 folderId（勿对 '' 做 UUID 校验）
    const normalizedFolderId = folderId?.trim() ? folderId : undefined
    if (normalizedFolderId !== undefined) {
      validateUuid(normalizedFolderId, 'folderId')
    }
    return this.folderService.getBreadcrumbs(userId, kbId, normalizedFolderId)
  }

  @Get(':kbId/search')
  async search(
    @CurrentUser('id') userId: string,
    @Param('kbId') kbId: string,
    @Query('q') query?: string,
  ) {
    validateUuid(kbId, 'kbId')
    const q = (query ?? '').trim()
    if (!q) {
      return { folders: [], documents: [] }
    }
    return this.kbService.search(userId, kbId, q)
  }
}
