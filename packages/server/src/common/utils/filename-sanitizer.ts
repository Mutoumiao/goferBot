import { randomUUID } from 'node:crypto'
import { BadRequestException } from '@nestjs/common'

const FILENAME_FORBIDDEN = /[\\/:*?"<>|\x00-\x1f\x7f]/g

export function sanitizeFilename(name: string): string {
  if (!name || typeof name !== 'string') {
    throw new BadRequestException({ code: 'INVALID_FILENAME', message: '文件名非法' })
  }
  let decoded = name
  try {
    decoded = decodeURIComponent(name)
  } catch {
    // fall back to raw value
  }
  if (decoded.includes('..') || decoded.includes('/') || decoded.includes('\\')) {
    throw new BadRequestException({ code: 'INVALID_FILENAME', message: '文件名包含非法字符' })
  }
  const clean = decoded.replace(FILENAME_FORBIDDEN, '').trim()
  if (!clean) {
    throw new BadRequestException({ code: 'INVALID_FILENAME', message: '文件名非法' })
  }
  return clean
}

export function buildStorageKey(
  kbId: string,
  originalName: string,
): { storageKey: string; safeName: string } {
  const safeName = sanitizeFilename(originalName)
  return { storageKey: `${kbId}/${randomUUID()}-${safeName}`, safeName }
}
