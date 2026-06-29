import { useNavigate, useParams } from '@tanstack/react-router'
import { App, Button, Card, Descriptions, Empty, Tag, Tooltip } from 'antd'
import { Eye, EyeOff, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { fetchSession, fetchSessionMessages, type SessionItem } from '../services'
import { MessageStream } from './MessageStream'

export function SessionDetail() {
  const params = useParams({ strict: false }) as { id?: string }
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [session, setSession] = useState<SessionItem | null>(null)
  const [messages, setMessages] = useState<Awaited<ReturnType<typeof fetchSessionMessages>>>([])
  const [loading, setLoading] = useState(false)
  const [masked, setMasked] = useState(true)

  const load = useCallback(
    async (id: string) => {
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
    },
    [message],
  )

  useEffect(() => {
    if (params.id) {
      void load(params.id)
    }
  }, [params.id, load])

  if (!session) {
    return (
      <div className="space-y-4">
        <PageHeader title="会话详情" onBack={() => navigate({ to: '/sessions' })} />
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
            <Button
              icon={<RefreshCw size={14} />}
              onClick={() => params.id && void load(params.id)}
            >
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
            <Tag
              color={
                session.status === 'active'
                  ? 'green'
                  : session.status === 'archived'
                    ? 'default'
                    : 'red'
              }
            >
              {session.status === 'active'
                ? '进行中'
                : session.status === 'archived'
                  ? '已归档'
                  : '已停止'}
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
        <MessageStream messages={messages} masked={masked} />
      </Card>
    </div>
  )
}
