import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../../auth/guards/jwt.guard.js'
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js'
import { DocumentService } from './document.service.js'
import { CreateDocumentDto } from './dto/create-document.dto.js'
import { UpdateDocumentDto } from './dto/update-document.dto.js'

@Controller('knowledge-bases/:kbId/documents')
@UseGuards(JwtAuthGuard)
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Get()
  async list(
    @CurrentUser('id') userId: string,
    @Param('kbId') kbId: string,
    @Query('folderId') folderId?: string,
  ) {
    return this.documentService.list(userId, kbId, folderId)
  }

  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @Param('kbId') kbId: string,
    @Body() dto: CreateDocumentDto,
  ) {
    return this.documentService.create(userId, kbId, dto)
  }

  @Patch(':docId')
  async update(
    @CurrentUser('id') userId: string,
    @Param('kbId') kbId: string,
    @Param('docId') docId: string,
    @Body() dto: UpdateDocumentDto,
  ) {
    return this.documentService.update(userId, kbId, docId, dto)
  }

  @Delete(':docId')
  async remove(
    @CurrentUser('id') userId: string,
    @Param('kbId') kbId: string,
    @Param('docId') docId: string,
  ) {
    return this.documentService.remove(userId, kbId, docId)
  }
}
