import { useState, useCallback, useEffect } from 'react'
import { Bubble, Sender, XProvider } from '@ant-design/x'
import { useXChat } from '@ant-design/x-sdk'
import { createGoferProvider } from '../services'
import type { GoferMessage, GoferInput } from '../providers/GoferChatProvider'
import { useChatStore } from '../store'
import { createChatSession, loadChatHistory, renameChatSession, confirmDeleteChatSession } from '../services'
import { useTabsStore } from '@/stores/tabs'
import { useSettingsStore } from '@/stores/settings'
import { getLLMConfig } from '@/utils/llm-config'
import { ChatSessionList } from './ChatSessionList'
import { KnowledgeBaseSelector } from './KnowledgeBaseSelector'
import { ChatMarkdown } from './ChatMarkdown'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertCircleIcon, XIcon } from 'lucide-react'

const FALLBACK_LLM_CONFIG = {
  provider: 'openai',
  model: 'gpt-3.5-turbo',
  baseUrl: 'https://api.openai.com',
  apiKey: '',
}

interface ChatSessionPageProps {
  sessionId: string
}

export function ChatSessionPage({ sessionId }: ChatSessionPageProps) {
  const {
    activeSession,
    sessions,
    isLoadingHistory,
    error,
    setActiveSession,
    clearError,
  } = useChatStore()

  const renameTab = useTabsStore((s) => s.renameTab)
  const settingsConfig = useSettingsStore((s) => s.config)
  const llmConfig = getLLMConfig(settingsConfig) ?? FALLBACK_LLM_CONFIG

  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [selectedKbIds, setSelectedKbIds] = useState<string[]>([])

  const providerRef = useState(() => createGoferProvider())[0]

  const {
    messages,
    onRequest,
    isRequesting,
    abort,
  } = useXChat<GoferMessage, GoferMessage, GoferInput>({
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

  useEffect(() => {
    import('../services').then(({ loadChatSessions }) => {
      loadChatSessions()
    })
  }, [])

  useEffect(() => {
    if (!sessionId) {
      setActiveSession(null)
      return
    }
    if (sessionId === 'new') {
      createChatSession().then((newSession) => {
        if (newSession) {
          setActiveSession(newSession)
          renameTab(newSession.id, newSession.title)
        }
      })
      return
    }
    import('../services').then(({ resolveSessionById }) => {
      resolveSessionById(sessionId).catch(() => {})
    })
  }, [sessionId, sessions, setActiveSession, renameTab])

  useEffect(() => {
    if (!activeSession?.id) return
    loadChatHistory(activeSession.id)

    const pendingKey = `pending_message_${activeSession.id}`
    const pendingMessage = sessionStorage.getItem(pendingKey)
    if (pendingMessage) {
      sessionStorage.removeItem(pendingKey)
      const timer = setTimeout(() => {
        handleSend(pendingMessage)
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [activeSession?.id])

  useEffect(() => {
    if (!error) return
    const timer = setTimeout(() => clearError(), 5000)
    return () => clearTimeout(timer)
  }, [error, clearError])

  const handleSend = useCallback(
    async (content: string) => {
      if (!content.trim()) return
      setErrorMessage(null)

      let sid = activeSession?.id
      if (!sid) {
        const newSession = await createChatSession()
        sid = newSession?.id
        if (newSession) {
          renameTab(newSession.id, newSession.title)
        }
      }

      if (!sid) {
        setErrorMessage('创建会话失败')
        return
      }

      onRequest({
        message: content,
        sessionId: sid,
        knowledgeBaseIds: selectedKbIds,
        config: {
          provider: llmConfig.provider,
          model: llmConfig.model,
          baseUrl: llmConfig.baseUrl,
        },
      })
    },
    [activeSession?.id, llmConfig, onRequest, renameTab, selectedKbIds],
  )

  const handleStop = useCallback(() => {
    abort()
  }, [abort])

  const handleRetry = useCallback(() => {
    const lastUserMsg = [...messages].reverse().find((m) => m.message.role === 'user')
    if (lastUserMsg) {
      setErrorMessage(null)
      onRequest({
        message: lastUserMsg.message.content,
        sessionId: activeSession?.id ?? sessionId ?? '',
        config: {
          provider: llmConfig.provider,
          model: llmConfig.model,
          baseUrl: llmConfig.baseUrl,
        },
      })
    }
  }, [messages, activeSession?.id, sessionId, llmConfig, onRequest])

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
    setSelectedKbIds((prev) =>
      prev.includes(kbId) ? prev.filter((id) => id !== kbId) : [...prev, kbId],
    )
  }, [])

  const bubbleItems = messages.map(({ id, message, status }) => ({
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
            onDeleteClick={(session) =>
              confirmDeleteChatSession(session, {
                onReload: () => {
                  import('../services').then(({ loadChatSessions }) => {
                    loadChatSessions()
                  })
                },
              })
            }
          />
        </div>

        <div className="flex flex-1 flex-col">
          <div className="flex h-12 items-center border-b border-border-default bg-surface-1 px-4">
            {isRenaming && activeSession ? (
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={handleConfirmRename}
                onKeyDown={(e) => {
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
              <div className="flex items-center justify-center py-8 text-sm text-text-secondary">
                加载中...
              </div>
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
                  contentRender: (content) => (
                    <div className="max-w-[75%] rounded-lg bg-brand-primary px-4 py-3 text-sm leading-relaxed text-white">
                      {content}
                    </div>
                  ),
                },
                assistant: {
                  placement: 'start',
                  contentRender: (content) => (
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
              <KnowledgeBaseSelector
                selectedIds={selectedKbIds}
                onToggle={handleToggleKb}
                disabled={isRequesting}
              />
              {selectedKbIds.length > 0 && (
                <span className="text-xs text-text-tertiary">已选 {selectedKbIds.length} 个知识库</span>
              )}
            </div>
            <Sender
              loading={isRequesting}
              onSubmit={(content) => handleSend(content)}
              onCancel={handleStop}
              placeholder={activeSession ? '继续对话...' : '输入消息开始新对话...'}
              className="rounded-lg border border-border-default bg-white"
            />
          </div>

          {error && (
            <div className="absolute bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-danger-600/20 bg-white px-4 py-2.5 text-sm text-danger-600 shadow-xl">
              <AlertCircleIcon className="size-4" />
              <span>{error}</span>
              <Button
                data-testid="error-toast-close"
                variant="ghost"
                size="icon-xs"
                onClick={clearError}
              >
                <XIcon className="size-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </XProvider>
  )
}
