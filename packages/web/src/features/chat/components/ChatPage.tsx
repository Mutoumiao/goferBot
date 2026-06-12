import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Bubble, Sender, XProvider } from '@ant-design/x'
import { useXChat } from '@ant-design/x-sdk'
import { Sparkles, Paperclip, Database, Send, FileText, FolderSearch, WandSparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { AlertCircleIcon, XIcon } from 'lucide-react'
import { createGoferProvider } from '../services'
import type { GoferMessage, GoferInput } from '../providers/GoferChatProvider'
import { useChatStore } from '../store'
import { createChatSession, loadChatHistory, renameChatSession, resolveSessionById } from '../services'
import { useTabsStore } from '@/stores/tabs'
import { ChatSessionList } from './ChatSessionList'
import { KnowledgeBaseSelector } from './KnowledgeBaseSelector'
import { ChatMarkdown } from './ChatMarkdown'

const QUICK_ACTIONS = [
  {
    id: 'summarize',
    icon: FileText,
    iconColor: '#3B6CF6',
    iconBg: '#EFF3FE',
    title: '总结文档',
    caption: '提炼重点与行动项',
    prompt: '请帮我总结这份文档的重点内容和行动项',
  },
  {
    id: 'search',
    icon: FolderSearch,
    iconColor: '#4C8F6A',
    iconBg: '#EEF8F3',
    title: '查找资料',
    caption: '跨知识库引用来源',
    prompt: '请在知识库中查找相关资料并引用来源',
  },
  {
    id: 'note',
    icon: WandSparkles,
    iconColor: '#7C6EE6',
    iconBg: '#F6F1FF',
    title: '生成笔记',
    caption: '把零散信息变成结构',
    prompt: '请帮我把这些信息整理成结构化的笔记',
  },
]

interface ChatPageProps {
  sessionId: string
}

/** sessionStorage key 前缀 */
const PENDING_MSG_KEY_PREFIX = 'pending_msg_'

function getPendingMessageKey(sessionId: string): string {
  return `${PENDING_MSG_KEY_PREFIX}${sessionId}`
}

export function ChatPage({ sessionId }: ChatPageProps) {
  const isTempSession = sessionId.startsWith('temp_')
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [selectedKbIds, setSelectedKbIds] = useState<string[]>([])
  const [hasAutoRenamed, setHasAutoRenamed] = useState(false)

  const navigate = useNavigate()

  const { activeSession, messages, isLoadingHistory, error, setActiveSession, clearError } = useChatStore()
  const renameTab = useTabsStore(s => s.renameTab)

  const providerRef = useState(() => createGoferProvider())[0]

  const { messages: xMessages, onRequest, isRequesting, abort } = useXChat<GoferMessage, GoferMessage, GoferInput>({
    provider: providerRef,
    requestPlaceholder: () => ({
      content: '正在思考中...',
      role: 'assistant',
    }),
    requestFallback: (_, { error: err, messageInfo }) => {
      if (err.name === 'AbortError') {
        return {
          content: messageInfo?.message?.content || '已取消回复',
          role: 'assistant',
        }
      }
      return {
        content: '网络异常，请稍后重试',
        role: 'assistant',
      }
    },
  })

  // 根据 sessionId 加载会话
  useEffect(() => {
    if (!isTempSession) {
      resolveSessionById(sessionId).catch(() => {})
    } else {
      setActiveSession(null)
    }
  }, [sessionId, isTempSession, setActiveSession])

  // 加载历史消息，并检查 sessionStorage 中的 pending message
  useEffect(() => {
    if (!isTempSession && activeSession?.id) {
      loadChatHistory(activeSession.id)

      const pendingKey = getPendingMessageKey(activeSession.id)
      const pending = sessionStorage.getItem(pendingKey)
      if (pending) {
        sessionStorage.removeItem(pendingKey)
        const timer = setTimeout(() => {
          handleSendRef.current(pending)
        }, 100)
        return () => clearTimeout(timer)
      }
    }
  }, [activeSession?.id, isTempSession])

  // 自动根据首条用户消息生成标题
  useEffect(() => {
    if (!activeSession || messages.length === 0 || hasAutoRenamed) return
    if (activeSession.title === '新对话' || activeSession.title === '会话页') {
      const firstUserMessage = messages.find(m => m.role === 'user')
      if (firstUserMessage) {
        setHasAutoRenamed(true)
        const title = generateTitleFromContent(firstUserMessage.content)
        renameChatSession(activeSession.id, title)
          .then(() => renameTab(activeSession.id, title))
          .catch(() => setHasAutoRenamed(false)) // 失败时允许重试
      }
    }
  }, [messages, activeSession, renameTab, hasAutoRenamed])

  // 错误自动清除
  useEffect(() => {
    if (!error) return
    const timer = setTimeout(() => clearError(), 5000)
    return () => clearTimeout(timer)
  }, [error, clearError])

  const handleSend = useCallback(
    async (content: string) => {
      if (!content.trim()) return
      setErrorMessage(null)

      const sid = activeSession?.id
      if (!sid) {
        setErrorMessage('会话加载中，请稍后再试')
        return
      }

      onRequest({
        input: content,
        sessionId: sid,
        knowledgeBaseIds: selectedKbIds,
      })
    },
    [activeSession?.id, onRequest, selectedKbIds]
  )

  // 使用 ref 保存最新的 handleSend，避免 useEffect 依赖循环
  const handleSendRef = useRef(handleSend)
  handleSendRef.current = handleSend

  const handleStop = useCallback(() => {
    abort()
  }, [abort])

  const handleRetry = useCallback(() => {
    const lastUserMsg = [...xMessages].reverse().find(m => m.message.role === 'user')
    if (lastUserMsg && activeSession?.id) {
      setErrorMessage(null)
      onRequest({
        input: lastUserMsg.message.content,
        sessionId: activeSession.id,
      })
    }
  }, [xMessages, activeSession?.id, onRequest])

  const handleStartRename = useCallback(() => {
    if (!activeSession) return
    setRenameValue(activeSession.title)
    setIsRenaming(true)
  }, [activeSession])

  const handleConfirmRename = useCallback(async () => {
    const trimmed = renameValue.trim()
    if (!trimmed || !activeSession) {
      setIsRenaming(false)
      return
    }
    if (trimmed !== activeSession.title) {
      await renameChatSession(activeSession.id, trimmed)
      renameTab(activeSession.id, trimmed)
    }
    setIsRenaming(false)
  }, [renameValue, activeSession, renameTab])

  const handleCancelRename = useCallback(() => {
    setIsRenaming(false)
    setRenameValue('')
  }, [])

  const handleToggleKb = useCallback((kbId: string) => {
    setSelectedKbIds(prev => (prev.includes(kbId) ? prev.filter(id => id !== kbId) : [...prev, kbId]))
  }, [])

  // 临时会话：提交后创建真实会话并替换路由
  const handleTempSubmit = useCallback(
    async (content: string) => {
      if (isLoading) return
      setIsLoading(true)

      try {
        const newSession = await createChatSession()
        if (!newSession?.id) {
          setIsLoading(false)
          return
        }

        // 先持久化 pending message，再导航
        sessionStorage.setItem(getPendingMessageKey(newSession.id), content.trim())

        // 替换路由，保持当前标签页
        navigate({
          to: '/chat/$sessionId',
          params: { sessionId: newSession.id },
          replace: true,
        })
      } finally {
        setIsLoading(false)
      }
    },
    [navigate, isLoading]
  )

  const handleTempKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        const trimmed = inputValue.trim()
        if (!trimmed) return
        handleTempSubmit(trimmed)
      }
    },
    [inputValue, handleTempSubmit]
  )

  // 渲染临时首页
  if (isTempSession) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-4 bg-surface-secondary">
        <div className="flex w-full max-w-[760px] flex-col items-center gap-8">
          <div className="flex h-[58px] w-[58px] items-center justify-center rounded-[22px] border border-[#E7EAF0] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.05)]">
            <Sparkles className="h-[26px] w-[26px] text-[#5B7CFA]" />
          </div>

          <h1 className="text-center text-[34px] font-medium leading-[1.18] text-[#1F2328]">
            今天想从知识库里理解什么？
          </h1>

          <div className="flex w-full flex-col gap-[18px] rounded-3xl border border-[#E7EAF0] bg-white p-5 shadow-[0_18px_42px_rgba(0,0,0,0.07)]">
            <Textarea
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleTempKeyDown}
              placeholder="询问、总结或让 AI 帮你整理桌面资料..."
              className="min-h-[60px] resize-none border-0 bg-transparent text-base text-[#1F2328] placeholder:text-[#9AA3AF] shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              disabled={isLoading}
            />

            <div className="flex items-end justify-between">
              <div className="flex items-center gap-2.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-[34px] w-[34px] rounded-[14px] bg-[#F4F5F7] text-[#5E6673] hover:bg-[#EBECF0]"
                  title="添加附件"
                  onClick={() => {}}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-[34px] gap-1.5 rounded-[14px] bg-[#F4F5F7] px-3 text-[#5E6673] hover:bg-[#EBECF0]"
                  onClick={() => {}}
                >
                  <Database className="h-[15px] w-[15px]" />
                  <span className="text-[13px]">全部知识库</span>
                </Button>
              </div>

              <Button
                size="icon"
                className="h-[38px] w-[38px] rounded-2xl bg-[#5B7CFA] text-white hover:bg-[#4A6BE8] disabled:opacity-50"
                onClick={() => {
                  const trimmed = inputValue.trim()
                  if (!trimmed) return
                  handleTempSubmit(trimmed)
                }}
                disabled={!inputValue.trim() || isLoading}
              >
                <Send className="h-[17px] w-[17px]" />
              </Button>
            </div>
          </div>

          <div className="flex w-full gap-[18px]">
            {QUICK_ACTIONS.map(action => (
              <Button
                key={action.id}
                variant="ghost"
                onClick={() => handleTempSubmit(action.prompt)}
                disabled={isLoading}
                className="group flex h-auto flex-1 items-center gap-3 rounded-[18px] border border-[#E7EAF0] bg-white/70 p-[18px] text-left transition-all hover:border-[#D1D5DB] hover:bg-white hover:shadow-sm disabled:opacity-50"
              >
                <div
                  className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[13px]"
                  style={{ backgroundColor: action.iconBg }}
                >
                  <action.icon className="h-4 w-4" style={{ color: action.iconColor }} />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-sm font-normal text-[#1F2328]">{action.title}</span>
                  <span className="text-xs text-[#9AA3AF]">{action.caption}</span>
                </div>
              </Button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // 渲染真实会话对话页
  const bubbleItems = xMessages.map(({ id, message, status }) => ({
    key: id,
    role: message.role,
    content: message.content,
    loading: status === 'loading',
  }))

  return (
    <XProvider>
      <div className="flex h-full">
        <div className="w-64 shrink-0">
          <ChatSessionList
            onRenameClick={() => {}}
            onDeleteClick={session =>
              import('../services').then(({ confirmDeleteChatSession }) => {
                confirmDeleteChatSession(session, {
                  onReload: () => {
                    import('../services').then(({ loadChatSessions }) => loadChatSessions())
                  },
                })
              })
            }
          />
        </div>

        <div className="flex flex-1 flex-col">
          <div className="flex h-12 items-center border-b border-border-default bg-surface-1 px-4">
            {isRenaming && activeSession ? (
              <Input
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onBlur={handleConfirmRename}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleConfirmRename()
                  if (e.key === 'Escape') handleCancelRename()
                }}
                className="h-7 w-64 text-sm font-medium"
                autoFocus
              />
            ) : (
              <h2
                className="cursor-pointer text-sm font-medium text-text-primary hover:text-brand-primary"
                onDoubleClick={handleStartRename}
                title="双击重命名"
              >
                {activeSession?.title ?? '新对话'}
              </h2>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {isLoadingHistory && (
              <div className="flex items-center justify-center py-8 text-sm text-text-secondary">加载中...</div>
            )}

            {!isLoadingHistory && messages.length === 0 && (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <h3 className="text-lg font-medium text-text-primary">开始新对话</h3>
                  <p className="mt-2 text-sm text-text-secondary">在下方输入消息，开始与 AI 对话</p>
                </div>
              </div>
            )}

            <Bubble.List
              role={{
                user: {
                  placement: 'end',
                  contentRender: content => (
                    <div className="max-w-[75%] rounded-lg bg-brand-primary px-4 py-3 text-sm leading-relaxed text-white">
                      {content}
                    </div>
                  ),
                },
                assistant: {
                  placement: 'start',
                  contentRender: content => (
                    <div className="max-w-[75%] rounded-lg bg-surface-2 px-4 py-3 text-sm leading-relaxed text-text-primary">
                      <ChatMarkdown content={String(content)} />
                    </div>
                  ),
                },
              }}
              items={bubbleItems}
            />

            {errorMessage && (
              <div className="mx-4 my-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                <p className="text-sm text-destructive-foreground">{errorMessage}</p>
                <Button
                  data-testid="error-retry-btn"
                  variant="destructive"
                  size="sm"
                  onClick={handleRetry}
                  className="mt-2"
                >
                  重试
                </Button>
              </div>
            )}
          </div>

          <div className="border-t border-border-default bg-surface-1 p-4">
            <div className="mb-2 flex items-center gap-2">
              <KnowledgeBaseSelector selectedIds={selectedKbIds} onToggle={handleToggleKb} disabled={isRequesting} />
              {selectedKbIds.length > 0 && (
                <span className="text-xs text-text-tertiary">已选 {selectedKbIds.length} 个知识库</span>
              )}
            </div>
            <Sender
              loading={isRequesting}
              onSubmit={content => handleSend(content)}
              onCancel={handleStop}
              placeholder={activeSession ? '继续对话...' : '输入消息开始新对话...'}
              className="rounded-lg border border-border-default bg-white"
            />
          </div>

          {error && (
            <div className="absolute bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-danger-600/20 bg-white px-4 py-2.5 text-sm text-danger-600 shadow-xl">
              <AlertCircleIcon className="size-4" />
              <span>{error}</span>
              <Button data-testid="error-toast-close" variant="ghost" size="icon-xs" onClick={clearError}>
                <XIcon className="size-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </XProvider>
  )
}

function generateTitleFromContent(content: string): string {
  const cleaned = content.replace(/[\n\r]/g, ' ').trim()
  return cleaned.slice(0, 20) + (cleaned.length > 20 ? '...' : '')
}
