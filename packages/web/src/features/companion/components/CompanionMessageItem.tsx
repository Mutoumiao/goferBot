import { Bubble } from '@ant-design/x'
import { XMarkdown } from '@ant-design/x-markdown'
import { ThumbsDown, ThumbsUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CompanionMessage } from '../types'
import { CompanionTypingIndicator } from './CompanionTypingIndicator'

interface CompanionMessageItemProps {
  message: CompanionMessage
  onFeedback: (messageId: string, rating: 'up' | 'down') => void
}

export function CompanionMessageItem({ message, onFeedback }: CompanionMessageItemProps) {
  const isUser = message.role === 'user'
  const isStreaming = message.streaming

  const content = isStreaming ? (
    <CompanionTypingIndicator content={message.content} />
  ) : isUser ? (
    message.content
  ) : (
    <XMarkdown content={message.content} streaming={{ hasNextChunk: false }} />
  )

  const placement = isUser ? 'end' : 'start'
  const variant = isUser ? 'filled' : 'borderless'

  return (
    <div className="group">
      <Bubble
        content={content}
        placement={placement}
        variant={variant}
        shape="round"
        styles={{ content: { fontSize: 14, lineHeight: 1.6 } }}
      />

      {!isUser && !isStreaming && (
        <div className={`flex gap-1 mt-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
          <Button
            variant={message.feedback?.rating === 'up' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onFeedback(message.id, 'up')}
            aria-label="点赞"
          >
            <ThumbsUp className="h-3 w-3" />
          </Button>
          <Button
            variant={message.feedback?.rating === 'down' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onFeedback(message.id, 'down')}
            aria-label="踩"
          >
            <ThumbsDown className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  )
}
