import { ConfigService } from '@nestjs/config'

let apiPrefix: string | undefined

export function initializeApiPath(configService: ConfigService): void {
  apiPrefix = configService.get<string>('API_PREFIX') ?? 'api'
}

export function getApiPrefix(): string {
  if (!apiPrefix) {
    throw new Error('API_PREFIX not initialized. Call initializeApiPath() first.')
  }
  return apiPrefix
}

export function buildApiPath(relativePath: string): string {
  const prefix = getApiPrefix()
  const path = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath
  return `/${prefix}/${path}`
}

/**
 * 路径工具函数集合
 * 用于统一管理 API 前缀和路径分类判断
 *
 * 使用方式：
 * - initializeApiPath(configService): 在应用启动时初始化 API 前缀（已在 bootstrap.ts 中调用）
 * - buildApiPath('chat') => '/api/chat' (根据环境变量 API_PREFIX 动态构建)
 * - categorizePath(path): 判断路径属于 public/admin-only/web-biz/common 类别
 * - isPublicPath/isAdminOnlyPath/isWebOnlyPath: 路径分类辅助判断函数
 */

export type PathCategory = 'public' | 'admin-only' | 'web-biz' | 'common'

const PUBLIC_PATHS = new Set(['public-key', 'captcha'])

function extractSecondSegment(path: string): string | undefined {
  const segments = path.split('/').filter(Boolean)
  if (segments.length >= 2) {
    return segments[1]
  }
  return undefined
}

function extractThirdSegment(path: string): string | undefined {
  const segments = path.split('/').filter(Boolean)
  if (segments.length >= 3) {
    return segments[2]
  }
  return undefined
}

export function isPublicPath(path: string): boolean {
  const secondSegment = extractSecondSegment(path)
  const thirdSegment = extractThirdSegment(path)
  return secondSegment === 'auth' && thirdSegment !== undefined && PUBLIC_PATHS.has(thirdSegment)
}

export function isAdminOnlyPath(path: string): boolean {
  const secondSegment = extractSecondSegment(path)
  return secondSegment === 'admin'
}

export function isWebOnlyPath(path: string): boolean {
  const secondSegment = extractSecondSegment(path)
  return secondSegment === 'web'
}

export function categorizePath(path: string): PathCategory {
  if (isPublicPath(path)) return 'public'
  if (isAdminOnlyPath(path)) return 'admin-only'
  if (isWebOnlyPath(path)) return 'web-biz'
  return 'common'
}
