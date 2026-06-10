import { useCallback, useEffect, useState } from 'react'
import { AlertCircleIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSettingsStore } from '@/stores/settings'
import { useTabsStore } from '@/stores/tabs'
import { getLLMConfig, type LLMConfig } from '@/utils/llm-config'
import { useChatStore } from '../store'
import {
  loadChatSessions,
  resolveSessionById,
  createChatSession,
  renameChatSession,
  deleteChatSession,
  loadChatHistory,
} from '../services'
import { useChatStream } from '../hooks/useChatStream'
import { ChatInput } from './ChatInput'
import { ChatMessage } from './ChatMessage'
import { EditorPlaceholder } from './EditorPlaceholder'
import { ChatSessionList } from './ChatSessionList'
import { openDialog } from '@/overlays/services/overlay-service'
import { DeleteSessionDialog } from '@/overlays/dialogs/DeleteSessionDialog'

const FALLBACK_LLM_CONFIG: LLMConfig = {
  provider: 'openai',
  model: 'gpt-4o',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
}

interface ChatSessionPageProps {
  sessionId: string
}

export function ChatSessionPage({ sessionId }: ChatSessionPageProps) {
  const {
    activeSession,
    sessions,
    messages,
    streamingContent,
    isStreaming,
    isLoadingHistory,
    error,
    setActiveSession,
    appendMessage,
    clearError,
  } = useChatStore()

  const renameTab = useTabsStore((s) => s.renameTab)
  const settingsConfig = useSettingsStore((s) => s.config)
  const llmConfig = getLLMConfig(settingsConfig) ?? FALLBACK_LLM_CONFIG

  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [errorRetryMessage, setErrorRetryMessage] = useState<string | null>(null)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')

  const { start: startStream, stop: stopStream } = useChatStream({
    llmConfig,
    onError: (msg) => {
      setErrorMessage(msg)
    },
  })

  useEffect(() => {
    loadChatSessions()
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
    resolveSessionById(sessionId).catch(() => {
      // 加载失败时静默处理
    })
  }, [sessionId, sessions, setActiveSession])

  useEffect(() => {
    if (!activeSession?.id) return
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

  useEffect(() => {
    if (activeSession?.id) {
      loadChatHistory(activeSession.id)
    }
  }, [activeSession?.id])

  const handleSend = useCallback(
    async (content: string, knowledgeBaseIds?: string[]) => {
      if (!content.trim()) return

      setErrorMessage(null)

      const userMsg = {
        id: `msg-${Date.now()}`,
        sessionId: activeSession?.id ?? '',
        role: 'user' as const,
        content,
        createdAt: new Date().toISOString(),
      }
      appendMessage(userMsg)
      setErrorRetryMessage(content)

      if (streamingContent) {
        useChatStore.setState({ streamingContent: '' })
      }

      let sid = activeSession?.id
      if (!sid) {
        const newSession = await createChatSession()
        sid = newSession?.id
        if (newSession) {
          renameTab(newSession.id, newSession.title)
        }
      }

      if (sid) {
        await startStream(content, sid, knowledgeBaseIds)
      }
    },
    [activeSession, appendMessage, startStream, streamingContent],
  )

  const handleStop = useCallback(() => {
    stopStream()
  }, [stopStream])

  const handleRetry = useCallback(() => {
    if (!errorRetryMessage) return
    setErrorMessage(null)
    handleSend(errorRetryMessage)
  }, [errorRetryMessage, handleSend])

  const handleDeleteSession = useCallback(
    async (sid: string, sessionTitle: string) => {
      const result = await openDialog<'confirm' | undefined>(DeleteSessionDialog, { sessionTitle })
      if (result === 'confirm') {
        await deleteChatSession(sid)
      }
    },
    [],
  )

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

  return (
    <div className="flex h-full">
      <div className="w-64 shrink-0">
        <ChatSessionList
          onRenameClick={() => {}}
          onDeleteClick={(session) => handleDeleteSession(session.id, session.title)}
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

        <div className="flex-1 overflow-y-auto">
          {isLoadingHistory && (
            <div className="flex items-center justify-center py-8 text-sm text-text-secondary">
              加载中...
            </div>
          )}

          {!isLoadingHistory && messages.length === 0 && !streamingContent && !errorMessage && (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <h3 className="text-lg font-medium text-text-primary">开始新对话</h3>
                <p className="mt-2 text-sm text-text-secondary">在下方输入消息，开始与 AI 对话</p>
                <EditorPlaceholder className="mt-6 mx-4" />
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}

          {isStreaming && streamingContent && (
            <ChatMessage
              message={{
                id: 'streaming',
                sessionId: activeSession?.id ?? '',
                role: 'assistant',
                content: streamingContent,
                createdAt: new Date().toISOString(),
              }}
            />
          )}

          {isStreaming && !streamingContent && (
            <div className="flex items-center gap-2 px-4 py-3">
              <div className="h-8 w-8 rounded-full bg-surface-3" />
              <div className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-text-tertiary" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-text-tertiary [animation-delay:0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-text-tertiary [animation-delay:0.3s]" />
              </div>
            </div>
          )}

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

        <ChatInput
          onSend={handleSend}
          isStreaming={isStreaming}
          onStop={handleStop}
          placeholder={activeSession ? '继续对话...' : '输入消息开始新对话...'}
        />

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
  )
}
