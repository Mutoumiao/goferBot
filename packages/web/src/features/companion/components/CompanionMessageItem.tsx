import { ThumbsDown, ThumbsUp } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Button } from '@/components/ui/button'
import type { CompanionMessage } from '../types'
import { CompanionTypingIndicator } from './CompanionTypingIndicator'

interface CompanionMessageItemProps {
  message: CompanionMessage
  /** thumb 仅 UI 层；页面内映射为 positive|negative */
  onFeedback: (messageId: string, thumb: 'up' | 'down') => void
}

export function CompanionMessageItem({ message, onFeedback }: CompanionMessageItemProps) {
  const isUser = message.role === 'user'
  const isStreaming = message.streaming
  const isPositive = message.feedback?.rating === 'positive'
  const isNegative = message.feedback?.rating === 'negative'

  const body = isStreaming ? (
    <CompanionTypingIndicator content={message.content} />
  ) : isUser ? (
    <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
  ) : (
    <div className="prose prose-sm max-w-none dark:prose-invert">
      <ReactMarkdown>{message.content || ' '}</ReactMarkdown>
    </div>
  )

  return (
    <div className={`group flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[85%]">
        <div
          className={
            isUser
              ? 'rounded-2xl bg-primary px-4 py-2 text-primary-foreground'
              : 'rounded-2xl bg-muted/60 px-4 py-2'
          }
        >
          {!isUser && message.isCare && (
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-rose-500">
              关怀{message.careScene ? ` · ${message.careScene}` : ''}
            </div>
          )}
          {body}
        </div>

        {!isUser && !isStreaming && (
          <div className="mt-1 flex gap-1">
            <Button
              variant={isPositive ? 'secondary' : 'ghost'}
              size="icon"
              className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
              onClick={() => onFeedback(message.id, 'up')}
              aria-label="点赞"
            >
              <ThumbsUp className="h-3 w-3" />
            </Button>
            <Button
              variant={isNegative ? 'secondary' : 'ghost'}
              size="icon"
              className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
              onClick={() => onFeedback(message.id, 'down')}
              aria-label="踩"
            >
              <ThumbsDown className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
