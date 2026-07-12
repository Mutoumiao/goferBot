import { Sender } from '@ant-design/x'
import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/spinner'
import {
  createConversation,
  getCompanion,
  listConversations,
  listMessages,
  submitFeedback,
} from '../services'
import { CompanionSseClient, type CompanionSseEvent } from '../sse-client'
import { useCompanionStore } from '../store'
import type { Companion, CompanionMessage, Conversation } from '../types'
import { CompanionHeader } from './CompanionHeader'
import { CompanionMessageItem } from './CompanionMessageItem'
import { CompanionQuickPrompts } from './CompanionQuickPrompts'

const DEFAULT_QUICK_PROMPTS = ['今天想聊点什么？', '说点开心的事吧', '我有点累，陪我一下']

interface CompanionChatPageProps {
  companionId: string
}

const sseClient = new CompanionSseClient()

export function CompanionChatPage({ companionId }: CompanionChatPageProps) {
  const navigate = useNavigate()
  const abortRef = useRef<AbortController | null>(null)
  const [inputValue, setInputValue] = useState('')

  const {
    messages,
    isLoadingHistory,
    isStreaming,
    setMessages,
    addMessage,
    updateMessage,
    setIsLoadingHistory,
    setIsStreaming,
    appendStreamingChunk,
    setStreamingMessageId,
    resetStreaming,
    upsertCompanion,
  } = useCompanionStore()

  const companionRef = useRef<Companion | null>(null)
  const conversationRef = useRef<Conversation | null>(null)
  const companion = useCompanionStore((s) => s.companions.find((c) => c.id === companionId) ?? null)

  const loadCompanion = useCallback(async () => {
    try {
      const res = await getCompanion(companionId).send()
      companionRef.current = res
      upsertCompanion(res)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '加载伴侣信息失败')
    }
  }, [companionId, upsertCompanion])

  const initConversation = useCallback(async () => {
    setIsLoadingHistory(true)
    try {
      const convRes = await listConversations(companionId).send()
      const activeConv = convRes.items?.[0] ?? null

      if (activeConv) {
        conversationRef.current = activeConv
        const msgRes = await listMessages(activeConv.id).send()
        const mapped: CompanionMessage[] =
          msgRes.items?.map((m) => ({
            id: m.id,
            conversationId: m.conversationId,
            role: m.role,
            content: m.content,
            createdAt: m.createdAt,
          })) ?? []
        setMessages(mapped)

        if (mapped.length === 0 && companionRef.current?.openingMessage) {
          addMessage({
            id: `system-${Date.now()}`,
            conversationId: activeConv.id,
            role: 'assistant',
            content: companionRef.current.openingMessage,
            createdAt: new Date().toISOString(),
          })
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '加载会话失败')
    } finally {
      setIsLoadingHistory(false)
    }
  }, [companionId, setMessages, addMessage, setIsLoadingHistory])

  useEffect(() => {
    loadCompanion()
    initConversation()
  }, [loadCompanion, initConversation])

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return

      let conv = conversationRef.current
      if (!conv) {
        try {
          const convRes = await createConversation({ companionId }).send()
          conv = convRes
          conversationRef.current = conv
        } catch (e) {
          toast.error(e instanceof Error ? e.message : '创建会话失败')
          return
        }
      }

      setInputValue('')

      const userMsg: CompanionMessage = {
        id: `user-${Date.now()}`,
        conversationId: conv.id,
        role: 'user',
        content: content.trim(),
        createdAt: new Date().toISOString(),
      }
      addMessage(userMsg)

      const assistantId = `streaming-${Date.now()}`
      addMessage({
        id: assistantId,
        conversationId: conv.id,
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        streaming: true,
      })

      setIsStreaming(true)
      setStreamingMessageId(assistantId)

      const controller = new AbortController()
      abortRef.current = controller

      let terminalReceived = false

      const handleEvent = (event: CompanionSseEvent) => {
        if (event.event === 'token') {
          const chunk = typeof event.data === 'string' ? event.data : String(event.data ?? '')
          if (chunk) appendStreamingChunk(chunk)
        } else if (event.event === 'done') {
          terminalReceived = true
          const data = event.data as {
            messageId?: string
            content?: string
            fullReply?: string
            createdAt?: string
          }
          const finalContent =
            data.content ||
            data.fullReply ||
            useCompanionStore.getState().streamingContent ||
            ''
          updateMessage(assistantId, {
            content: finalContent || '（无内容）',
            streaming: false,
          })
          setIsStreaming(false)
          setStreamingMessageId(null)
        } else if (event.event === 'error') {
          terminalReceived = true
          const errData = event.data as { message?: string }
          const msg = errData?.message || 'AI 回复出错，请重试'
          toast.error(msg)
          updateMessage(assistantId, {
            content:
              useCompanionStore.getState().streamingContent ||
              `（回复失败：${msg.slice(0, 80)}）`,
            streaming: false,
          })
          setIsStreaming(false)
          setStreamingMessageId(null)
        }
      }

      const handleError = (err: Error) => {
        if (!terminalReceived) {
          terminalReceived = true
          toast.error(err.message || '流式响应中断')
          updateMessage(assistantId, {
            content: '（回复中断，请重试）',
            streaming: false,
          })
          setIsStreaming(false)
          setStreamingMessageId(null)
        }
      }

      try {
        await sseClient.chat({
          conversationId: conv.id,
          content: content.trim(),
          onEvent: handleEvent,
          onError: handleError,
          signal: controller.signal,
        })

        if (!terminalReceived) {
          updateMessage(assistantId, {
            content: useCompanionStore.getState().streamingContent || '（无内容）',
            streaming: false,
          })
          setIsStreaming(false)
          setStreamingMessageId(null)
        }
      } catch {
        resetStreaming()
        setIsStreaming(false)
        setStreamingMessageId(null)
      }
    },
    [
      companionId,
      isStreaming,
      addMessage,
      updateMessage,
      setIsStreaming,
      setStreamingMessageId,
      appendStreamingChunk,
      resetStreaming,
    ],
  )

  const handleFeedback = useCallback(
    async (messageId: string, rating: 'up' | 'down') => {
      try {
        await submitFeedback(messageId, { rating: rating === 'up' ? 1 : -1 }).send()
        updateMessage(messageId, {
          feedback: {
            rating,
            comment: undefined,
          },
        })
        toast.success(rating === 'up' ? '感谢反馈' : '已记录反馈')
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '反馈提交失败')
      }
    },
    [updateMessage],
  )

  const handleOpenMemories = useCallback(() => {
    navigate({
      to: '/companions/$companionId/memories',
      params: { companionId },
    })
  }, [navigate, companionId])

  const handleBack = useCallback(() => {
    navigate({ to: '/companions' })
  }, [navigate])

  const quickPrompts = companion?.openingMessage
    ? [companion.openingMessage, ...DEFAULT_QUICK_PROMPTS]
    : DEFAULT_QUICK_PROMPTS

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
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[760px] px-4 py-8">
          {isLoadingHistory ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Spinner className="h-6 w-6" />
            </div>
          ) : messages.length === 0 ? (
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
              {messages.map((msg) => (
                <CompanionMessageItem key={msg.id} message={msg} onFeedback={handleFeedback} />
              ))}
              {messages.filter((m) => !m.streaming).length === 0 && (
                <CompanionQuickPrompts
                  prompts={quickPrompts}
                  onSelect={handleSendMessage}
                  disabled={isStreaming}
                />
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-center px-4 pb-6 pt-2">
        <Sender
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleSendMessage}
          loading={isStreaming}
          placeholder={`和 ${companion.name} 说点什么...`}
          submitType="enter"
          autoSize={{ minRows: 3, maxRows: 6 }}
        />
      </div>
    </div>
  )
}
