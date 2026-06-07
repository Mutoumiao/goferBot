import { useState, useRef, useCallback } from 'react'
import { cn } from '@/utils/cn'

interface ChatInputProps {
  onSend: (content: string) => void
  disabled?: boolean
  placeholder?: string
  isStreaming?: boolean
  onStop?: () => void
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = '输入消息...',
  isStreaming = false,
  onStop,
}: ChatInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || disabled || isStreaming) return
    onSend(trimmed)
    setValue('')
    textareaRef.current?.focus()
  }, [value, disabled, isStreaming, onSend])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (isStreaming) return
      handleSend()
    }
  }

  return (
    <div className="flex items-end gap-2 border-t border-border-default bg-surface-1 p-4">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled || isStreaming}
        placeholder={placeholder}
        rows={2}
        className={cn(
          'flex-1 resize-none rounded-md border px-3 py-2 text-sm',
          'border-border-default bg-surface-1 text-text-primary',
          'focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      />
      {isStreaming ? (
        <button
          onClick={onStop}
          className={cn(
            'rounded-md px-4 py-2 text-sm font-medium text-white',
            'bg-destructive hover:bg-destructive/90',
          )}
        >
          停止
        </button>
      ) : (
        <button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          className={cn(
            'rounded-md px-4 py-2 text-sm font-medium text-white',
            'bg-brand-primary hover:bg-brand-secondary',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          发送
        </button>
      )}
    </div>
  )
}
