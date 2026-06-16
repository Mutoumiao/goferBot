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
  Req,
  BadRequestException,
} from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import { JwtAuthGuard } from '../../auth/guards/jwt.guard.js'
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js'
import { DocumentService } from './document.service.js'
import { CreateDocumentDto } from './dto/create-document.dto.js'
import { UpdateDocumentDto } from './dto/update-document.dto.js'
import { FileValidationPipe } from '../../common/pipes/file-validation.pipe.js'

@Controller('knowledge-bases/:kbId/documents')
@UseGuards(JwtAuthGuard)
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Get()
  async list(
    @CurrentUser('id') userId: string,
    @Param('kbId') kbId: string,
    @Query('folderId') folderId?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    if (folderId !== undefined && folderId !== '') {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(folderId)) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'folderId 格式非法',
        })
      }
    }
    return this.documentService.list(
      userId,
      kbId,
      folderId,
      sortBy as 'name' | 'createdAt' | 'updatedAt' | 'size' | 'type' | undefined,
      sortOrder as 'asc' | 'desc' | undefined,
    )
  }

  @Post('upload')
  async upload(
    @CurrentUser('id') userId: string,
    @Param('kbId') kbId: string,
    @Req() req: FastifyRequest,
  ) {
    const pipe = new FileValidationPipe({
      allowedExtensions: ['md', 'txt', 'html', 'csv', 'json', 'pdf'],
      allowedMimeTypes: [
        'text/markdown',
        'text/x-markdown',
        'text/plain',
        'text/html',
        'text/csv',
        'application/json',
        'application/pdf',
      ],
    })
    const file = await pipe.transform(req)
    return this.documentService.upload(userId, kbId, file)
  }

  @Get(':docId/preview')
  async preview(
    @CurrentUser('id') userId: string,
    @Param('kbId') kbId: string,
    @Param('docId') docId: string,
  ) {
    return this.documentService.preview(userId, kbId, docId)
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
