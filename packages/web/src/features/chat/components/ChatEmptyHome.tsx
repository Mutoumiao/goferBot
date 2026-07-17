import { Star } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth'
import { fetchProviders, submitTempChat } from '../services'
import { useChatStore } from '../store'
import { ChatComposer } from './ChatComposer'

function retryFetchProviders() {
  void fetchProviders({ force: true })
}

function greetingByHour(hour: number): string {
  if (hour < 6) return '夜深了'
  if (hour < 12) return '早上好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

/**
 * 右侧聊天工作区空态：问候 + 统一 ChatComposer（仅已实现能力）
 */
export function ChatEmptyHome() {
  const user = useAuthStore((s) => s.user)
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedKbIds, setSelectedKbIds] = useState<string[]>([])
  const [localError, setLocalError] = useState<string | null>(null)

  const availableProviders = useChatStore((s) => s.availableProviders)
  const selectedProviderKey = useChatStore((s) => s.selectedProviderKey)
  const isInitLoading = useChatStore((s) => s.isInitLoading)
  const initError = useChatStore((s) => s.initError)
  const setSelectedProviderKey = useChatStore((s) => s.setSelectedProviderKey)
  const setSelectedSessionId = useChatStore((s) => s.setSelectedSessionId)

  const displayName = user?.name?.trim() || '朋友'
  const greeting = greetingByHour(new Date().getHours())

  async function handleSubmit(content: string) {
    if (isLoading) return
    if (selectedKbIds.length === 0) {
      setLocalError('请先选择至少一个知识库')
      return
    }
    setLocalError(null)
    setIsLoading(true)
    try {
      const sessionId = await submitTempChat(content, {
        knowledgeBaseIds: selectedKbIds,
      })
      if (!sessionId) {
        toast.error('创建会话失败，请重试')
        return
      }
      setSelectedSessionId(sessionId)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden bg-surface-1"
      data-testid="chat-empty-home"
    >
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-10">
        <div className="flex w-full max-w-[720px] flex-col items-center gap-7">
          <div className="flex flex-col items-center">
            <div
              className="gofer-brand-gradient gofer-soft-shadow flex h-[72px] w-[72px] items-center justify-center rounded-xl text-white"
              aria-hidden
            >
              <Star className="h-8 w-8 fill-white/95" />
            </div>
            <h1
              className="mt-6 text-center text-[32px] font-semibold leading-tight tracking-tight text-text-primary"
              data-testid="chat-home-greeting"
            >
              {greeting} {displayName}
            </h1>
            <p className="mt-2 max-w-md text-center text-sm text-text-secondary">
              选择知识库后开始提问，回答将引用相关文档来源
            </p>
          </div>

          <ChatComposer
            value={inputValue}
            onChange={(v) => {
              setInputValue(v)
              if (localError) setLocalError(null)
            }}
            onSubmit={(content) => void handleSubmit(content)}
            loading={isLoading}
            selectedKbIds={selectedKbIds}
            onChangeKbIds={setSelectedKbIds}
            selectedProviderKey={selectedProviderKey}
            onChangeProvider={setSelectedProviderKey}
            providers={availableProviders}
            isInitLoading={isInitLoading}
            initError={initError}
            onRetryProviders={retryFetchProviders}
            error={localError}
            showDisclaimer
            maxWidthClassName="max-w-full"
            sendTestId="temp-send-btn"
          />

          {initError && (
            <div
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-error/25 bg-error/5 px-4 py-2.5 text-sm text-error"
              data-testid="init-error-banner"
            >
              <span>模型列表加载失败：{initError}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={retryFetchProviders}
                className="text-brand-blue hover:bg-brand-blue/10"
              >
                重试
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
