/** 与服务端 companion avatar 基线对齐（客户端预检） */
export const COMPANION_AVATAR_ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp'] as const
export const COMPANION_AVATAR_MAX_BYTES = 5 * 1024 * 1024
export const COMPANION_AVATAR_MIN_SHORT_SIDE = 720
export const COMPANION_AVATAR_TARGET_RATIO = 2 / 3
export const COMPANION_AVATAR_RATIO_TOLERANCE = 0.05

export function validateCompanionAvatarClient(input: {
  mimeType: string
  sizeBytes: number
  width: number
  height: number
}): { ok: true } | { ok: false; message: string } {
  if (
    !COMPANION_AVATAR_ALLOWED_MIME.includes(
      input.mimeType as (typeof COMPANION_AVATAR_ALLOWED_MIME)[number],
    )
  ) {
    return { ok: false, message: '仅支持 PNG、JPEG、WebP 格式' }
  }
  if (input.sizeBytes > COMPANION_AVATAR_MAX_BYTES) {
    return { ok: false, message: '头像文件大小不能超过 5MB' }
  }
  const shortSide = Math.min(input.width, input.height)
  if (shortSide < COMPANION_AVATAR_MIN_SHORT_SIDE) {
    return {
      ok: false,
      message: `图片最短边须 ≥ ${COMPANION_AVATAR_MIN_SHORT_SIDE}px`,
    }
  }
  const ratio = input.width / input.height
  const minR = COMPANION_AVATAR_TARGET_RATIO * (1 - COMPANION_AVATAR_RATIO_TOLERANCE)
  const maxR = COMPANION_AVATAR_TARGET_RATIO * (1 + COMPANION_AVATAR_RATIO_TOLERANCE)
  if (ratio < minR || ratio > maxR) {
    return { ok: false, message: '头像宽高比须约为 2:3' }
  }
  return { ok: true }
}

export function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('无法读取图片'))
    }
    img.src = url
  })
}
