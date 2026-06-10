import ReactMarkdown from 'react-markdown'
import type { Message } from '@goferbot/data'
import { cn } from '@/utils/cn'

interface ChatMessageProps {
  message: Message
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex w-full gap-3 px-4 py-3', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium',
          isUser ? 'order-2 bg-brand-primary text-white' : 'order-1 bg-surface-3 text-text-secondary',
        )}
      >
        {isUser ? 'U' : 'AI'}
      </div>

      <div
        className={cn(
          'max-w-[75%] rounded-lg px-4 py-3 text-sm leading-relaxed',
          isUser ? 'order-1 bg-brand-primary text-white' : 'order-2 bg-surface-2 text-text-primary',
        )}
      >
        {isUser ? (
          <p>{message.content}</p>
        ) : (
          <div className="prose prose-sm max-w-none prose-headings:text-text-primary prose-p:text-text-primary prose-a:text-brand-primary prose-code:bg-surface-3 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-surface-3 prose-pre:text-text-primary">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}
