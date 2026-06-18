import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js'
import { JwtAuthGuard } from '../../auth/guards/jwt.guard.js'
import { FileValidationPipe } from '../../common/pipes/file-validation.pipe.js'
import { DocumentService } from './document.service.js'
import { CopyDocumentDto } from './dto/copy-document.dto.js'
import { CreateDocumentDto } from './dto/create-document.dto.js'
import { MoveDocumentDto } from './dto/move-document.dto.js'
import { UpdateDocumentDto } from './dto/update-document.dto.js'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
      if (!UUID_REGEX.test(folderId)) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'folderId 格式非法',
        })
      }
    }
    return this.documentService.list(userId, kbId, folderId, sortBy, sortOrder)
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

  @Post(':docId/move')
  @HttpCode(200)
  async move(
    @CurrentUser('id') userId: string,
    @Param('kbId') kbId: string,
    @Param('docId') docId: string,
    @Body() dto: MoveDocumentDto,
  ) {
    return this.documentService.move(userId, kbId, docId, dto)
  }

  @Post(':docId/copy')
  @HttpCode(200)
  async copy(
    @CurrentUser('id') userId: string,
    @Param('kbId') kbId: string,
    @Param('docId') docId: string,
    @Body() dto: CopyDocumentDto,
  ) {
    return this.documentService.copy(userId, kbId, docId, dto)
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
