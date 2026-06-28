import { Empty, Tag, Timeline } from 'antd'
import type { SessionMessage } from '../services'

export interface MessageStreamProps {
  messages: SessionMessage[]
  masked: boolean
}

export function MessageStream({ messages, masked }: MessageStreamProps) {
  const maskSensitive = (text: string) => {
    if (!masked) return text
    return text
      .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '***@***.***')
      .replace(/\b1[3-9]\d{9}\b/g, '***-****-****')
      .replace(/\b(\d{1,3}\.){3}\d{1,3}\b/g, '***.***.***.***')
  }

  if (messages.length === 0) {
    return <Empty description="暂无消息" />
  }

  return (
    <Timeline
      items={messages.map((msg) => ({
        color: msg.role === 'user' ? 'blue' : msg.role === 'assistant' ? 'green' : 'gray',
        children: (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Tag
                color={
                  msg.role === 'user' ? 'blue' : msg.role === 'assistant' ? 'green' : 'default'
                }
              >
                {msg.role === 'user' ? '用户' : msg.role === 'assistant' ? '助手' : '系统'}
              </Tag>
              <span className="text-xs text-slate-400">
                {new Date(msg.createdAt).toLocaleString('zh-CN')}
                {msg.tokenCount != null && ` · ${msg.tokenCount} tokens`}
              </span>
            </div>
            <div
              className={`whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm ${msg.role === 'user' ? 'border-l-4 border-blue-300' : 'border-l-4 border-green-300'}`}
            >
              {maskSensitive(msg.content)}
            </div>
            {msg.retrievalDocs && msg.retrievalDocs.length > 0 && (
              <div className="mt-2 space-y-1 rounded-md bg-amber-50/50 p-2 text-xs">
                <div className="font-medium text-amber-700">
                  检索片段 ({msg.retrievalDocs.length})
                </div>
                {msg.retrievalDocs.map((doc) => (
                  <div key={doc.id} className="text-slate-600">
                    <span className="font-medium">{doc.name}</span>
                    <span className="ml-2 text-slate-400">
                      相关度: {(doc.score * 100).toFixed(1)}%
                    </span>
                    <div className="ml-2 text-slate-500">{maskSensitive(doc.snippet)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ),
      }))}
    />
  )
}
