import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { Card, Button, Timeline, Tag, Empty, App, Tooltip, Descriptions } from 'antd'
import { ArrowLeft, Eye, EyeOff, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { fetchSession, fetchSessionMessages, type SessionItem, type SessionMessage } from '../services'

export function SessionDetail() {
  const params = useParams({ strict: false }) as { id?: string }
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [session, setSession] = useState<SessionItem | null>(null)
  const [messages, setMessages] = useState<SessionMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [masked, setMasked] = useState(true)

  const load = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const [s, m] = await Promise.all([fetchSession(id), fetchSessionMessages(id)])
      setSession(s)
      setMessages(m)
    } catch {
      message.error('加载会话详情失败')
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    if (params.id) {
      void load(params.id)
    }
  }, [params.id, load])

  const maskSensitive = (text: string) => {
    if (!masked) return text
    return text
      .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '***@***.***')
      .replace(/\b1[3-9]\d{9}\b/g, '***-****-****')
      .replace(/\b(\d{1,3}\.){3}\d{1,3}\b/g, '***.***.***.***')
  }

  if (!session) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="会话详情"
          onBack={() => navigate({ to: '/sessions' })}
        />
        <Card loading={loading}>
          <Empty description="会话不存在" />
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={session.title}
        description={`${session.userEmail} · ${session.model} · ${session.messageCount} 条消息`}
        onBack={() => navigate({ to: '/sessions' })}
        extra={
          <div className="flex items-center gap-2">
            <Tooltip title={masked ? '显示敏感信息' : '隐藏敏感信息'}>
              <Button
                icon={masked ? <EyeOff size={14} /> : <Eye size={14} />}
                onClick={() => setMasked(!masked)}
              >
                {masked ? '显示明文' : '隐藏敏感信息'}
              </Button>
            </Tooltip>
            <Button icon={<RefreshCw size={14} />} onClick={() => params.id && void load(params.id)}>
              刷新
            </Button>
          </div>
        }
      />

      <Card loading={loading} title="会话信息" size="small">
        <Descriptions column={4} size="small">
          <Descriptions.Item label="ID">{session.id}</Descriptions.Item>
          <Descriptions.Item label="用户">{session.userEmail}</Descriptions.Item>
          <Descriptions.Item label="模型">
            <Tag>{session.model}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={session.status === 'active' ? 'green' : session.status === 'archived' ? 'default' : 'red'}>
              {session.status === 'active' ? '进行中' : session.status === 'archived' ? '已归档' : '已停止'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="创建时间" span={2}>
            {new Date(session.createdAt).toLocaleString('zh-CN')}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间" span={2}>
            {new Date(session.updatedAt).toLocaleString('zh-CN')}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card loading={loading} title="消息流">
        {messages.length === 0 ? (
          <Empty description="暂无消息" />
        ) : (
          <Timeline
            items={messages.map((msg) => ({
              color: msg.role === 'user' ? 'blue' : msg.role === 'assistant' ? 'green' : 'gray',
              children: (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Tag color={msg.role === 'user' ? 'blue' : msg.role === 'assistant' ? 'green' : 'default'}>
                      {msg.role === 'user' ? '用户' : msg.role === 'assistant' ? '助手' : '系统'}
                    </Tag>
                    <span className="text-xs text-slate-400">
                      {new Date(msg.createdAt).toLocaleString('zh-CN')}
                      {msg.tokenCount != null && ` · ${msg.tokenCount} tokens`}
                    </span>
                  </div>
                  <div className={`whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm ${msg.role === 'user' ? 'border-l-4 border-blue-300' : 'border-l-4 border-green-300'}`}>
                    {maskSensitive(msg.content)}
                  </div>
                  {msg.retrievalDocs && msg.retrievalDocs.length > 0 && (
                    <div className="mt-2 space-y-1 rounded-md bg-amber-50/50 p-2 text-xs">
                      <div className="font-medium text-amber-700">检索片段 ({msg.retrievalDocs.length})</div>
                      {msg.retrievalDocs.map((doc) => (
                        <div key={doc.id} className="text-slate-600">
                          <span className="font-medium">{doc.name}</span>
                          <span className="ml-2 text-slate-400">相关度: {(doc.score * 100).toFixed(1)}%</span>
                          <div className="ml-2 text-slate-500">{maskSensitive(doc.snippet)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ),
            }))}
          />
        )}
      </Card>
    </div>
  )
}
