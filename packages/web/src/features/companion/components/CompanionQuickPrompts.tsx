import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CompanionQuickPromptsProps {
  prompts: string[]
  onSelect: (prompt: string) => void
  disabled?: boolean
}

export function CompanionQuickPrompts({ prompts, onSelect, disabled }: CompanionQuickPromptsProps) {
  if (prompts.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 p-4">
      {prompts.map((prompt) => (
        <Button
          key={prompt}
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onSelect(prompt)}
          className="text-sm"
        >
          <Sparkles className="h-3 w-3 mr-1" />
          {prompt}
        </Button>
      ))}
    </div>
  )
}
