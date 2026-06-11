import { useState } from 'react'
import { cn } from '@/utils/cn'
import { User } from 'lucide-react'

export interface AvatarProps {
  src?: string | null
  fallback?: string
  size?: number
  className?: string
}

/** 提取首字母作为占位文字，最多取两个字符（中英文均取第一个） */
function getInitials(name?: string): string {
  if (!name) return ''
  return name.trim().slice(0, 1).toUpperCase()
}

export function Avatar({ src, fallback, size = 40, className }: AvatarProps) {
  const [imgError, setImgError] = useState(false)
  const hasValidSrc = src && !imgError

  const initials = getInitials(fallback)

  return (
    <div
      className={cn(
        'relative shrink-0 select-none overflow-hidden rounded-full bg-brand-primary',
        className,
      )}
      style={{ width: size, height: size }}
      title={fallback}
    >
      {hasValidSrc ? (
        <img
          src={src!}
          alt={fallback ?? '头像'}
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
          loading="lazy"
        />
      ) : initials ? (
        <span
          className="flex h-full w-full items-center justify-center font-medium text-white"
          style={{ fontSize: Math.max(size * 0.4, 12) }}
        >
          {initials}
        </span>
      ) : (
        <span className="flex h-full w-full items-center justify-center text-white">
          <User className="h-[55%] w-[55%]" />
        </span>
      )}
    </div>
  )
}
