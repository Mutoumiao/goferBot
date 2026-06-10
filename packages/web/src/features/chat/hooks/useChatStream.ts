import { useCallback, useRef } from 'react'
import { useSSE } from 'alova/client'
import { streamChat } from '@/api/chat'
import { useChatStore } from '../store'
import { parseSSEChunk } from '@/utils/sse-parser'
import type { LLMConfig } from '@/utils/llm-config'

interface UseChatStreamOptions {
  llmConfig: LLMConfig
  onError?: (message: string) => void
}

export function useChatStream({ llmConfig, onError }: UseChatStreamOptions) {
  const { appendStreamContent, flushStreamContent, setIsStreaming } = useChatStore()
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  const { send: sseSend, close: sseClose, onMessage, onError: onSSEError } = useSSE(
    (message: string, sessionId: string, _config: LLMConfig, knowledgeBaseIds?: string[]) =>
      streamChat({
        message,
        sessionId,
        knowledgeBaseIds: knowledgeBaseIds ?? [],
        config: _config,
      }),
    {
      interceptByGlobalResponded: false,
      immediate: false,
      reconnectionTime: 3000,
    },
  )

  onMessage((event: { data: string }) => {
    const parsed = parseSSEChunk(event)
    if (!parsed) return

    if (parsed.error) {
      onErrorRef.current?.(parsed.error)
      setIsStreaming(false)
      return
    }
    if (parsed.done) {
      flushStreamContent()
      setIsStreaming(false)
    } else {
      appendStreamContent(parsed.chunk)
    }
  })

  onSSEError((event: { error: Error }) => {
    onErrorRef.current?.(event.error?.message ?? '网络连接失败，请检查网络后重试')
    setIsStreaming(false)
  })

  const start = useCallback(
    async (message: string, sessionId: string, knowledgeBaseIds?: string[]) => {
      setIsStreaming(true)
      sseSend(message, sessionId, llmConfig, knowledgeBaseIds)
    },
    [sseSend, llmConfig, setIsStreaming],
  )

  const stop = useCallback(() => {
    sseClose()
    flushStreamContent()
    setIsStreaming(false)
  }, [sseClose, flushStreamContent, setIsStreaming])

  return { start, stop }
}
