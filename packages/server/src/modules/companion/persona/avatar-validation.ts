/**
 * 伴侣头像硬性基线（对齐 ai-partner-agent 量级，容差写入黄金测试常量）
 */
export const COMPANION_AVATAR_ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp'] as const

/** 默认 ≤ 5MB */
export const COMPANION_AVATAR_MAX_BYTES = 5 * 1024 * 1024

/** 最短边 ≥ 720px */
export const COMPANION_AVATAR_MIN_SHORT_SIDE = 720

/** 目标宽:高 ≈ 2:3 */
export const COMPANION_AVATAR_TARGET_RATIO = 2 / 3

/** 宽高比容差 ±5% */
export const COMPANION_AVATAR_RATIO_TOLERANCE = 0.05

export type CompanionAvatarValidationOk = { ok: true }
export type CompanionAvatarValidationErr = { ok: false; message: string }
export type CompanionAvatarValidationResult =
  | CompanionAvatarValidationOk
  | CompanionAvatarValidationErr

export function validateCompanionAvatarMeta(input: {
  mimeType: string
  sizeBytes: number
  width: number
  height: number
}): CompanionAvatarValidationResult {
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
  if (input.width <= 0 || input.height <= 0) {
    return { ok: false, message: '无法读取图片尺寸' }
  }
  const shortSide = Math.min(input.width, input.height)
  if (shortSide < COMPANION_AVATAR_MIN_SHORT_SIDE) {
    return {
      ok: false,
      message: `图片最短边须 ≥ ${COMPANION_AVATAR_MIN_SHORT_SIDE}px（当前 ${shortSide}px）`,
    }
  }
  const ratio = input.width / input.height
  const minRatio = COMPANION_AVATAR_TARGET_RATIO * (1 - COMPANION_AVATAR_RATIO_TOLERANCE)
  const maxRatio = COMPANION_AVATAR_TARGET_RATIO * (1 + COMPANION_AVATAR_RATIO_TOLERANCE)
  if (ratio < minRatio || ratio > maxRatio) {
    return {
      ok: false,
      message: `头像宽高比须约为 2:3（当前 ${input.width}×${input.height}）`,
    }
  }
  return { ok: true }
}
