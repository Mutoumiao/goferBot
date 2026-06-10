import { cn } from '@/utils/cn'

interface EditorPlaceholderProps {
  className?: string
}

export function EditorPlaceholder({ className }: EditorPlaceholderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-md border-2 border-dashed border-border-default p-8',
        'text-sm text-text-tertiary',
        className,
      )}
    >
      <div className="text-center">
        <p className="text-lg">📝</p>
        <p className="mt-2">BlockNote 编辑器即将上线</p>
        <p className="mt-1 text-xs">富文本编辑区域（BlockNote 完整集成分离到独立 issue）</p>
      </div>
    </div>
  )
}
