import { Button } from '@/components/ui/button'
import { QUICK_ACTIONS } from '../constants'

interface QuickActionsProps {
  onAction: (prompt: string) => void
  disabled?: boolean
}

export function QuickActions({ onAction, disabled = false }: QuickActionsProps) {
  return (
    <div className="flex w-full gap-[18px]">
      {QUICK_ACTIONS.map((action) => (
        <Button
          key={action.id}
          variant="ghost"
          onClick={() => onAction(action.prompt)}
          disabled={disabled}
          className="group flex h-auto flex-1 items-center gap-3 rounded-2xl border border-border-default bg-surface-1/70 p-[18px] text-left transition-all hover:border-border-subtle hover:bg-surface-1 hover:shadow-sm disabled:opacity-50"
        >
          <div
            className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-xl ${action.iconBg}`}
          >
            <action.icon className={`h-4 w-4 ${action.iconColor}`} />
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-sm font-normal text-text-primary">{action.title}</span>
            <span className="text-xs text-text-tertiary">{action.caption}</span>
          </div>
        </Button>
      ))}
    </div>
  )
}
