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
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { KnowledgeBaseService } from './knowledge-base.service.js'
import { CreateFolderDto, createFolderSchema } from './dto/create-folder.dto.js'
import { UpdateFolderDto, updateFolderSchema } from './dto/update-folder.dto.js'

@Controller('knowledge-bases/:kbId/folders')
@UseGuards(JwtAuthGuard)
export class FolderController {
  constructor(private readonly kbService: KnowledgeBaseService) {}

  @Get()
  async list(
    @CurrentUser('id' as never) userId: string,
    @Param('kbId') kbId: string,
    @Query('parentId') parentId?: string,
  ) {
    return this.kbService.listFolders(userId, kbId, parentId)
  }

  @Post()
  async create(
    @CurrentUser('id' as never) userId: string,
    @Param('kbId') kbId: string,
    @Body(new ZodValidationPipe(createFolderSchema)) dto: CreateFolderDto,
  ) {
    return this.kbService.createFolder(userId, kbId, dto)
  }

  @Patch(':folderId')
  async update(
    @CurrentUser('id' as never) userId: string,
    @Param('kbId') kbId: string,
    @Param('folderId') folderId: string,
    @Body(new ZodValidationPipe(updateFolderSchema)) dto: UpdateFolderDto,
  ) {
    return this.kbService.updateFolder(userId, kbId, folderId, dto)
  }

  @Delete(':folderId')
  async remove(
    @CurrentUser('id' as never) userId: string,
    @Param('kbId') kbId: string,
    @Param('folderId') folderId: string,
  ) {
    return this.kbService.removeFolder(userId, kbId, folderId)
  }
}
