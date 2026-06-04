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
import { CreateFolderDto } from './dto/create-folder.dto.js'
import { UpdateFolderDto } from './dto/update-folder.dto.js'

@Controller('knowledge-bases/:kbId/folders')
@UseGuards(JwtAuthGuard)
export class FolderController {
  constructor(private readonly kbService: KnowledgeBaseService) {}

  @Get()
  async list(
    @CurrentUser('id') userId: string,
    @Param('kbId') kbId: string,
    @Query('parentId') parentId?: string,
  ) {
    return this.kbService.listFolders(userId, kbId, parentId)
  }

  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @Param('kbId') kbId: string,
    @Body() dto: CreateFolderDto,
  ) {
    return this.kbService.createFolder(userId, kbId, dto)
  }

  @Patch(':folderId')
  async update(
    @CurrentUser('id') userId: string,
    @Param('kbId') kbId: string,
    @Param('folderId') folderId: string,
    @Body() dto: UpdateFolderDto,
  ) {
    return this.kbService.updateFolder(userId, kbId, folderId, dto)
  }

  @Delete(':folderId')
  async remove(
    @CurrentUser('id') userId: string,
    @Param('kbId') kbId: string,
    @Param('folderId') folderId: string,
  ) {
    return this.kbService.removeFolder(userId, kbId, folderId)
  }
}
