import type { MultipartFile } from '@fastify/multipart'
import {
  Injectable,
  PayloadTooLargeException,
  PipeTransform,
  UnsupportedMediaTypeException,
} from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import { sanitizeFilename } from '../utils/filename-sanitizer.js'

interface FileValidationOptions {
  allowedMimeTypes?: string[]
  allowedExtensions?: string[]
  maxSizeBytes?: number
  fieldName?: string
}

interface ValidatedFile {
  filename: string
  ext: string
  mimeType: string
  size: number
  buffer: Buffer
  folderId: string | null
}

@Injectable()
export class FileValidationPipe implements PipeTransform {
  constructor(private readonly options: FileValidationOptions = {}) {}

  async transform(req: FastifyRequest): Promise<ValidatedFile> {
    const {
      allowedMimeTypes = [
        'text/markdown',
        'text/x-markdown',
        'text/plain',
        'text/html',
        'text/csv',
        'application/json',
        'application/pdf',
      ],
      allowedExtensions = ['md', 'txt', 'html', 'csv', 'json', 'pdf'],
      maxSizeBytes = 50 * 1024 * 1024,
    } = this.options

    const data = await req.file()
    if (!data) {
      throw new UnsupportedMediaTypeException({
        code: 'UNSUPPORTED_TYPE',
        message: '未找到上传文件',
      })
    }

    const filename = sanitizeFilename(data.filename)
    const ext = this.getExt(filename)
    if (!ext || !allowedExtensions.includes(ext)) {
      throw new UnsupportedMediaTypeException({
        code: 'UNSUPPORTED_TYPE',
        message: '不支持的文件类型',
      })
    }

    const mimeType = data.mimetype || 'application/octet-stream'
    if (!allowedMimeTypes.includes(mimeType)) {
      // 文本类型 mimetype 可能因系统不同而不一致，允许通过后缀判断
      const textExts = new Set(['txt', 'md', 'html', 'csv', 'json'])
      if (!textExts.has(ext)) {
        throw new UnsupportedMediaTypeException({
          code: 'UNSUPPORTED_TYPE',
          message: '不支持的文件类型',
        })
      }
    }

    const chunks: Buffer[] = []
    let totalSize = 0
    for await (const chunk of data.file) {
      const buf = chunk as Buffer
      totalSize += buf.length
      if (totalSize > maxSizeBytes) {
        throw new PayloadTooLargeException({
          code: 'PAYLOAD_TOO_LARGE',
          message: `文件超过 ${maxSizeBytes / 1024 / 1024}MB 限制`,
        })
      }
      chunks.push(buf)
    }
    const buffer = Buffer.concat(chunks)

    if (data.file.truncated) {
      throw new PayloadTooLargeException({
        code: 'PAYLOAD_TOO_LARGE',
        message: `文件超过 ${maxSizeBytes / 1024 / 1024}MB 限制`,
      })
    }

    const folderId = this.extractFolderId(data.fields)

    return {
      filename,
      ext,
      mimeType,
      size: buffer.length,
      buffer,
      folderId,
    }
  }

  private getExt(name: string): string | null {
    const idx = name.lastIndexOf('.')
    return idx > 0 ? name.slice(idx + 1).toLowerCase() : null
  }

  private extractFolderId(fields?: MultipartFile['fields']): string | null {
    if (!fields) return null
    const folderField = fields.folderId
    if (folderField && !Array.isArray(folderField) && 'value' in folderField) {
      return (folderField.value as string) || null
    }
    return null
  }
}
