export const AVATAR_ALLOWED_MIME_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

export const AVATAR_EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

export const AVATAR_MAX_SIZE = 5 * 1024 * 1024
