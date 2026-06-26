import { MessageCircle, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Companion } from '../types'
import { CompanionStatusTag } from './CompanionStatusTag'

interface CompanionCardProps {
  companion: Companion
  onSelect: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

export function CompanionCard({ companion, onSelect, onEdit, onDelete }: CompanionCardProps) {
  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={() => onSelect(companion.id)}
    >
      <CardContent className="p-4">
        <div className="flex gap-3 items-start">
          <div
            className="h-14 w-14 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-medium"
            style={{
              backgroundImage: companion.avatarKey
                ? `url(/api/files/${companion.avatarKey})`
                : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            {!companion.avatarKey && companion.name.charAt(0)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-base truncate">{companion.name}</h3>
                {companion.headline && (
                  <p className="text-sm text-muted-foreground truncate">{companion.headline}</p>
                )}
              </div>
              <CompanionStatusTag status={companion.status} />
            </div>

            {companion.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                {companion.description}
              </p>
            )}

            <div className="flex items-center justify-between mt-3">
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect(companion.id)
                }}
              >
                <MessageCircle className="h-4 w-4 mr-1" />
                开始聊天
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" onClick={(e) => e.stopPropagation()}>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(companion.id)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    编辑
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={() => onDelete(companion.id)}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    删除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
