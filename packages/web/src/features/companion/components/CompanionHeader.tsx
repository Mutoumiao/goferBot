import { ArrowLeft, Brain, Heart, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Companion } from '../types'
import { CompanionStatusTag } from './CompanionStatusTag'

interface CompanionHeaderProps {
  companion: Companion
  onBack: () => void
  onOpenMemories: () => void
  onOpenCare?: () => void
  onEdit?: () => void
}

export function CompanionHeader({
  companion,
  onBack,
  onOpenMemories,
  onOpenCare,
  onEdit,
}: CompanionHeaderProps) {
  return (
    <div className="flex items-center gap-3 p-4 border-b">
      <Button variant="ghost" size="icon" onClick={onBack} aria-label="返回">
        <ArrowLeft className="h-5 w-5" />
      </Button>

      <div
        className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 text-base font-medium"
        style={{
          backgroundImage: companion.avatarUrl
            ? `url(${companion.avatarUrl})`
            : companion.avatarKey
              ? `url(/api/files/${companion.avatarKey})`
              : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {!companion.avatarUrl && !companion.avatarKey && companion.name.charAt(0)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-medium truncate">{companion.name}</h2>
          <CompanionStatusTag status={companion.status} />
        </div>
        {companion.headline && (
          <p className="text-sm text-muted-foreground truncate">{companion.headline}</p>
        )}
      </div>

      {onEdit && (
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Pencil className="h-4 w-4 mr-1" />
          编辑
        </Button>
      )}
      {onOpenCare && (
        <Button variant="outline" size="sm" onClick={onOpenCare}>
          <Heart className="h-4 w-4 mr-1" />
          关怀
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={onOpenMemories}>
        <Brain className="h-4 w-4 mr-1" />
        记忆库
      </Button>
    </div>
  )
}
