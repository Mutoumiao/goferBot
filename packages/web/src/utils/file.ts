import type { LucideIcon } from 'lucide-react'
import { FileArchive, FileCode, FileMusic, FileText, FileVideo, Image } from 'lucide-react'

export function getFileIcon(ext: string | null): LucideIcon {
  switch (ext?.toLowerCase()) {
    case '.png':
    case '.jpg':
    case '.jpeg':
    case '.gif':
    case '.svg':
    case '.webp':
      return Image
    case '.zip':
    case '.rar':
    case '.7z':
    case '.tar':
    case '.gz':
      return FileArchive
    case '.js':
    case '.ts':
    case '.tsx':
    case '.jsx':
    case '.py':
    case '.json':
    case '.yaml':
      return FileCode
    case '.mp3':
    case '.wav':
    case '.flac':
    case '.aac':
      return FileMusic
    case '.mp4':
    case '.avi':
    case '.mov':
    case '.mkv':
      return FileVideo
    default:
      return FileText
  }
}

export function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return '--'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}
