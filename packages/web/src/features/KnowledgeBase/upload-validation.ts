/** 单文件大小上限（与后端限制对齐） */
export const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

/** 允许的扩展名（小写，含点） */
export const ALLOWED_EXTENSIONS = ['.md', '.txt', '.html', '.csv', '.json', '.pdf'] as const

/** `<input accept>` 属性值 */
export const UPLOAD_ACCEPT = '.md,.txt,.html,.csv,.json,.pdf'

const ILLEGAL_FILENAME_PATTERN = /[\x00-\x1f\x7f]|\.\.|\/|\\/

export type UploadRejectCode = 'type' | 'oversize' | 'name'

export type UploadValidationResult =
  | { valid: true }
  | { valid: false; error: string; code: UploadRejectCode }

function getExtension(fileName: string): string {
  const idx = fileName.lastIndexOf('.')
  if (idx <= 0 || idx === fileName.length - 1) return ''
  return `.${fileName.slice(idx + 1).toLowerCase()}`
}

/**
 * 客户端上传校验：以扩展名 + 50MB + 非法文件名为主。
 * DropZone 与 uploadFiles 共用，避免双轨规则。
 * 注意：仅 UX 门禁，安全边界在后端。
 */
export function validateUploadFile(file: File): UploadValidationResult {
  const ext = getExtension(file.name)
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    return { valid: false, error: '不支持的文件类型', code: 'type' }
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: '超过 50MB 限制', code: 'oversize' }
  }
  if (ILLEGAL_FILENAME_PATTERN.test(file.name)) {
    return { valid: false, error: '文件名包含非法字符', code: 'name' }
  }
  return { valid: true }
}

export function partitionUploadFiles(files: File[]): {
  valid: File[]
  rejected: { name: string; reason: string; code: UploadRejectCode }[]
} {
  const valid: File[] = []
  const rejected: { name: string; reason: string; code: UploadRejectCode }[] = []
  for (const file of files) {
    const result = validateUploadFile(file)
    if (result.valid) {
      valid.push(file)
    } else {
      rejected.push({ name: file.name, reason: result.error, code: result.code })
    }
  }
  return { valid, rejected }
}
