import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { KbSelector } from './KbSelector'

interface ChatInputProps {
  onSend: (content: string, knowledgeBaseIds?: string[]) => void
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
  const [selectedKbIds, setSelectedKbIds] = useState<string[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleToggleKb = useCallback((kbId: string) => {
    setSelectedKbIds((prev) =>
      prev.includes(kbId) ? prev.filter((id) => id !== kbId) : [...prev, kbId],
    )
  }, [])

  const handleSend = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || disabled || isStreaming) return
    onSend(trimmed, selectedKbIds)
    setValue('')
    textareaRef.current?.focus()
  }, [value, disabled, isStreaming, selectedKbIds, onSend])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (isStreaming) return
      handleSend()
    }
  }

  return (
    <div className="border-t border-border-default bg-surface-1 p-4">
      <div className="mb-2 flex items-center gap-2">
        <KbSelector
          selectedIds={selectedKbIds}
          onToggle={handleToggleKb}
          disabled={disabled || isStreaming}
        />
        {selectedKbIds.length > 0 && (
          <span className="text-xs text-text-tertiary">
            已选 {selectedKbIds.length} 个知识库
          </span>
        )}
      </div>
      <div className="flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isStreaming}
          placeholder={placeholder}
          rows={2}
          className="flex-1 resize-none"
        />
        {isStreaming ? (
          <Button variant="destructive" onClick={onStop}>
            停止
          </Button>
        ) : (
          <Button
            onClick={handleSend}
            disabled={disabled || !value.trim()}
          >
            发送
          </Button>
        )}
      </div>
    </div>
  )
}
