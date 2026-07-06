type PathCategory = 'public' | 'admin-only' | 'web-biz' | 'common'

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

function isPublicPath(path: string): boolean {
  const secondSegment = extractSecondSegment(path)
  const thirdSegment = extractThirdSegment(path)
  return secondSegment === 'auth' && thirdSegment !== undefined && PUBLIC_PATHS.has(thirdSegment)
}

export function isAdminOnlyPath(path: string): boolean {
  const secondSegment = extractSecondSegment(path)
  return secondSegment === 'admin'
}

function isWebOnlyPath(path: string): boolean {
  const secondSegment = extractSecondSegment(path)
  return secondSegment === 'web'
}

export function categorizePath(path: string): PathCategory {
  if (isPublicPath(path)) return 'public'
  if (isAdminOnlyPath(path)) return 'admin-only'
  if (isWebOnlyPath(path)) return 'web-biz'
  return 'common'
}
