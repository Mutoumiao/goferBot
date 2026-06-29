import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { StorageService } from '../../processors/storage/storage.service.js'
import { KbRepository } from './repositories/kb.repository.js'

@Injectable()
export class DocumentPreviewService {
  constructor(
    private readonly storage: StorageService,
    private readonly kbRepository: KbRepository,
  ) {}

  async preview(
    userId: string,
    kbId: string,
    doc: {
      id: string
      kbId: string
      ext: string | null
      mimeType: string | null
      storageKey: string | null
    },
  ) {
    await this.ensureOwnership(userId, kbId)
    if (!doc || doc.kbId !== kbId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '文档不存在' })
    }

    const textExts = new Set(['md', 'txt', 'html', 'csv', 'json'])
    if (doc.ext && textExts.has(doc.ext.toLowerCase())) {
      if (!doc.storageKey) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: '文档无存储对象' })
      }
      const buffer = await this.storage.downloadFile(doc.storageKey)
      const MAX_PREVIEW_SIZE = 5 * 1024 * 1024
      if (buffer.length > MAX_PREVIEW_SIZE) {
        throw new BadRequestException({
          code: 'PREVIEW_TOO_LARGE',
          message: `预览文件超过 ${MAX_PREVIEW_SIZE / 1024 / 1024}MB 限制`,
        })
      }
      return {
        type: 'text',
        mimeType: doc.mimeType || 'text/plain',
        content: buffer.toString('utf-8'),
      }
    }

    if (doc.ext === 'pdf') {
      return {
        type: 'pdf',
        mimeType: 'application/pdf',
        url: doc.storageKey ? this.storage.getUrl(doc.storageKey) : null,
      }
    }

    return {
      type: 'unsupported',
      mimeType: doc.mimeType || 'application/octet-stream',
      url: doc.storageKey ? this.storage.getUrl(doc.storageKey) : null,
    }
  }

  private async ensureOwnership(userId: string, kbId: string) {
    const kb = await this.kbRepository.findById(kbId)
    if (!kb) throw new NotFoundException('资源不存在或无权访问')
    if (kb.userId !== userId) throw new ForbiddenException('资源不存在或无权访问')
  }
}
