/**
 * Companion 聊天页 — AI SDK useChat + CompanionChatTransport
 * 主路径不再依赖 @ant-design/x Sender。
 */
import { useChat } from '@ai-sdk/react'
import { useNavigate } from '@tanstack/react-router'
import type { UIMessage } from 'ai'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { CompanionChatTransport } from '../companion-chat-transport'
import { buildOpeningUiMessage, shouldShowOpeningMessage } from '../persona/opening-message'
import {
  createConversation,
  getCompanion,
  listConversations,
  listMessages,
  submitFeedback,
} from '../services'
import { useCompanionStore } from '../store'
import type { Companion, CompanionMessage, Conversation, FeedbackRating } from '../types'
import { uiThumbToRating } from '../types'
import { CompanionHeader } from './CompanionHeader'
import { CompanionMessageItem } from './CompanionMessageItem'
import { CompanionQuickPrompts } from './CompanionQuickPrompts'

const DEFAULT_QUICK_PROMPTS = ['今天想聊点什么？', '说点开心的事吧', '我有点累，陪我一下']

interface CompanionChatPageProps {
  companionId: string
}

function textFromUiMessage(msg: UIMessage): string {
  const parts = msg.parts ?? []
  return parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('')
}

function toUiMessage(m: {
  id: string
  role: string
  content: string
  metadata?: string | null
}): UIMessage {
  let metadata: Record<string, unknown> | undefined
  if (m.metadata) {
    try {
      metadata = JSON.parse(m.metadata) as Record<string, unknown>
    } catch {
      metadata = undefined
    }
  }
  return {
    id: m.id,
    role: m.role as UIMessage['role'],
    parts: [{ type: 'text', text: m.content }],
    ...(metadata ? { metadata } : {}),
  } as UIMessage
}

function isCareFromMessage(m: UIMessage): { isCare: boolean; careScene?: string } {
  const meta = (m as UIMessage & { metadata?: { care?: { scene?: string } } }).metadata
  if (meta?.care?.scene) {
    return { isCare: true, careScene: meta.care.scene }
  }
  return { isCare: false }
}

export function CompanionChatPage({ companionId }: CompanionChatPageProps) {
  const navigate = useNavigate()
  const [inputValue, setInputValue] = useState('')
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [feedbackMap, setFeedbackMap] = useState<
    Record<string, { rating: FeedbackRating; reason?: string }>
  >({})

  const conversationRef = useRef<Conversation | null>(null)
  const companionRef = useRef<Companion | null>(null)
  const upsertCompanion = useCompanionStore((s) => s.upsertCompanion)
  const companion = useCompanionStore((s) => s.companions.find((c) => c.id === companionId) ?? null)

  const transport = useMemo(
    () =>
      new CompanionChatTransport({
        getConversationId: () => conversationRef.current?.id ?? '',
      }),
    [],
  )

  const { messages, sendMessage, status, setMessages, error, stop, clearError } = useChat({
    transport,
    onError: (err) => {
      toast.error(err.message || '对话失败')
    },
  })

  const isStreaming = status === 'submitted' || status === 'streaming'

  const bootstrap = useCallback(async () => {
    setIsLoadingHistory(true)
    try {
      // 先加载伴侣，避免与会话初始化竞态导致开场白丢失
      const res = await getCompanion(companionId).send()
      companionRef.current = res
      upsertCompanion(res)

      const convRes = await listConversations(companionId).send()
      const activeConv = convRes.items?.[0] ?? null

      if (activeConv) {
        conversationRef.current = activeConv
        const msgRes = await listMessages(activeConv.id).send()
        const items = msgRes.items ?? []
        const uiMsgs = items.map((m) =>
          toUiMessage({
            id: m.id,
            role: m.role,
            content: m.content,
            metadata: (m as { metadata?: string | null }).metadata,
          }),
        )

        const openingText = res.openingMessage?.trim()
        if (
          openingText &&
          shouldShowOpeningMessage({
            messageCount: uiMsgs.length,
            openingMessage: openingText,
          })
        ) {
          const opening = buildOpeningUiMessage({
            conversationId: activeConv.id,
            companionId,
            openingMessage: openingText,
          })
          uiMsgs.push(toUiMessage(opening))
        }

        // 历史 feedback 回填（listMessages 已挂 feedback）
        const nextFeedback: Record<string, { rating: FeedbackRating; reason?: string }> = {}
        for (const m of items) {
          if (m.feedback?.rating) {
            nextFeedback[m.id] = {
              rating: m.feedback.rating,
              reason: m.feedback.reason,
            }
          }
        }
        setFeedbackMap(nextFeedback)
        setMessages(uiMsgs)
      } else {
        conversationRef.current = null
        const openingText = res.openingMessage?.trim()
        if (
          openingText &&
          shouldShowOpeningMessage({
            messageCount: 0,
            openingMessage: openingText,
          })
        ) {
          const opening = buildOpeningUiMessage({
            conversationId: null,
            companionId,
            openingMessage: openingText,
          })
          setMessages([toUiMessage(opening)])
        } else {
          setMessages([])
        }
        setFeedbackMap({})
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '加载会话失败')
    } finally {
      setIsLoadingHistory(false)
    }
  }, [companionId, setMessages, upsertCompanion])

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  useEffect(() => {
    if (error) {
      toast.error(error.message)
      clearError()
    }
  }, [error, clearError])

  const ensureConversation = useCallback(async (): Promise<Conversation | null> => {
    if (conversationRef.current) return conversationRef.current
    try {
      const convRes = await createConversation({ companionId }).send()
      conversationRef.current = convRes
      return convRes
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '创建会话失败')
      return null
    }
  }, [companionId])

  const handleSendMessage = useCallback(
    async (content: string) => {
      const text = content.trim()
      if (!text || isStreaming) return

      const conv = await ensureConversation()
      if (!conv) return

      setInputValue('')
      await sendMessage(
        { text },
        {
          body: { conversationId: conv.id },
        },
      )
    },
    [ensureConversation, isStreaming, sendMessage],
  )

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault()
      void handleSendMessage(inputValue)
    },
    [handleSendMessage, inputValue],
  )

  const handleFeedback = useCallback(async (messageId: string, thumb: 'up' | 'down') => {
    const rating = uiThumbToRating(thumb)
    try {
      await submitFeedback(messageId, { rating }).send()
      setFeedbackMap((prev) => ({ ...prev, [messageId]: { rating } }))
      toast.success(rating === 'positive' ? '感谢反馈' : '已记录反馈')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '反馈提交失败')
    }
  }, [])

  const handleOpenMemories = useCallback(() => {
    navigate({
      to: '/companions/$companionId/memories',
      params: { companionId },
    })
  }, [navigate, companionId])

  const handleOpenCare = useCallback(() => {
    navigate({
      to: '/companions/$companionId/care',
      params: { companionId },
    })
  }, [navigate, companionId])

  const handleEdit = useCallback(() => {
    navigate({
      // 官方 system 源不可进人设编辑（列表侧已隐藏；此处防御）
      to: '/companions/$companionId/edit',
      params: { companionId },
    })
  }, [navigate, companionId])

  const handleBack = useCallback(() => {
    navigate({ to: '/companions' })
  }, [navigate])

  const displayMessages: CompanionMessage[] = useMemo(() => {
    const convId = conversationRef.current?.id ?? ''
    return messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => {
        const care = isCareFromMessage(m)
        return {
          id: m.id,
          conversationId: convId,
          role: m.role as 'user' | 'assistant',
          content: textFromUiMessage(m),
          createdAt: new Date().toISOString(),
          streaming:
            isStreaming && m.id === messages[messages.length - 1]?.id && m.role === 'assistant',
          feedback: feedbackMap[m.id] ?? null,
          isCare: care.isCare,
          careScene: care.careScene,
        }
      })
  }, [messages, isStreaming, feedbackMap])

  const quickPrompts = companion?.openingMessage
    ? [companion.openingMessage, ...DEFAULT_QUICK_PROMPTS]
    : DEFAULT_QUICK_PROMPTS

  /** 仅客户端开场白（id 以 opening- 开头）时仍展示快捷提示，避免「有开场白就无法点提示」 */
  const onlyOpeningUi =
    displayMessages.length > 0 && displayMessages.every((m) => m.id.startsWith('opening-'))
  const showQuickPrompts = displayMessages.length === 0 || onlyOpeningUi

  if (!companion) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-white">
      <CompanionHeader
        companion={companion}
        onBack={handleBack}
        onOpenMemories={handleOpenMemories}
        onOpenCare={handleOpenCare}
        onEdit={companion.source === 'system' ? undefined : handleEdit}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[760px] px-4 py-8">
          {isLoadingHistory ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Spinner className="h-6 w-6" />
            </div>
          ) : displayMessages.length === 0 ? (
            <div className="flex h-64 items-center justify-center">
              <div className="text-center">
                <h3 className="text-lg font-medium">开始新对话</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  在下方输入消息，开始与 {companion.name} 对话
                </p>
                <CompanionQuickPrompts
                  prompts={quickPrompts}
                  onSelect={handleSendMessage}
                  disabled={isStreaming}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {displayMessages.map((msg) => (
                <CompanionMessageItem key={msg.id} message={msg} onFeedback={handleFeedback} />
              ))}
              {showQuickPrompts ? (
                <CompanionQuickPrompts
                  prompts={DEFAULT_QUICK_PROMPTS}
                  onSelect={handleSendMessage}
                  disabled={isStreaming}
                />
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-center px-4 pb-6 pt-2">
        <form
          className="w-full max-w-[760px] rounded-xl border bg-background p-3 shadow-sm"
          onSubmit={handleSubmit}
        >
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void handleSendMessage(inputValue)
              }
            }}
            disabled={isStreaming}
            placeholder={`和 ${companion.name} 说点什么...`}
            rows={3}
            className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            {isStreaming && (
              <Button type="button" variant="ghost" size="sm" onClick={() => stop()}>
                停止
              </Button>
            )}
            <Button type="submit" size="sm" disabled={isStreaming || !inputValue.trim()}>
              {isStreaming ? '发送中…' : '发送'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
