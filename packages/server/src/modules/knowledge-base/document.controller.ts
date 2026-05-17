import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req, UnsupportedMediaTypeException, PayloadTooLargeException } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import { JwtAuthGuard } from '../../auth/guards/jwt.guard.js'
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js'
import { DocumentService } from './document.service.js'
import { CreateDocumentDto } from './dto/create-document.dto.js'
import { UpdateDocumentDto } from './dto/update-document.dto.js'

const ALLOWED_MIME_TYPES = new Set([
  'text/markdown',
  'text/plain',
  'application/pdf',
  'text/x-markdown',
])

const ALLOWED_EXTS = new Set(['md', 'txt', 'pdf'])

function sanitizeFilename(name: string): string {
  // 拒绝路径穿越字符
  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    throw new UnsupportedMediaTypeException({
      code: 'UNSUPPORTED_TYPE',
      message: '文件名包含非法字符',
    })
  }
  // 去除不可打印字符和控制字符
  const clean = name.replace(/[\x00-\x1f\x7f]/g, '').trim()
  if (!clean) {
    throw new UnsupportedMediaTypeException({
      code: 'UNSUPPORTED_TYPE',
      message: '文件名非法',
    })
  }
  return clean
}

function getExt(name: string): string | null {
  const idx = name.lastIndexOf('.')
  return idx > 0 ? name.slice(idx + 1).toLowerCase() : null
}

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

  @Post('upload')
  async upload(
    @CurrentUser('id') userId: string,
    @Param('kbId') kbId: string,
    @Req() req: FastifyRequest,
  ) {
    const data = await req.file()
    if (!data) {
      throw new UnsupportedMediaTypeException({
        code: 'UNSUPPORTED_TYPE',
        message: '未找到上传文件',
      })
    }

    const filename = sanitizeFilename(data.filename)
    const ext = getExt(filename)
    if (!ext || !ALLOWED_EXTS.has(ext)) {
      throw new UnsupportedMediaTypeException({
        code: 'UNSUPPORTED_TYPE',
        message: '不支持的文件类型',
      })
    }

    const mimeType = data.mimetype || 'application/octet-stream'
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      // 对于 txt/md，mimetype 可能不一致，允许通过后缀判断
      if (!(ext === 'txt' || ext === 'md')) {
        throw new UnsupportedMediaTypeException({
          code: 'UNSUPPORTED_TYPE',
          message: '不支持的文件类型',
        })
      }
    }

    const MAX_SIZE = 50 * 1024 * 1024
    const chunks: Buffer[] = []
    let totalSize = 0
    for await (const chunk of data.file) {
      const buf = chunk as Buffer
      totalSize += buf.length
      if (totalSize > MAX_SIZE) {
        throw new PayloadTooLargeException({
          code: 'PAYLOAD_TOO_LARGE',
          message: '文件超过 50MB 限制',
        })
      }
      chunks.push(buf)
    }
    const buffer = Buffer.concat(chunks)

    const folderField = data.fields?.folderId
    const folderId = folderField && !Array.isArray(folderField) && 'value' in folderField
      ? (folderField.value as string | undefined)
      : undefined

    return this.documentService.upload(userId, kbId, {
      filename,
      ext,
      mimeType,
      size: buffer.length,
      buffer,
      folderId: folderId || null,
    })
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
