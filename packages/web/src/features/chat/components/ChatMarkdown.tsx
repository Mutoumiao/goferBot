import { XMarkdown } from '@ant-design/x-markdown'

interface ChatMarkdownProps {
  content: string
}

export function ChatMarkdown({ content }: ChatMarkdownProps) {
  return (
    <div className="prose prose-sm max-w-none">
      <XMarkdown content={content} />
    </div>
  )
}
