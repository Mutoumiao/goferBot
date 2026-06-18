import { XProvider } from '@ant-design/x'
import { Paperclip, Send, Sparkles } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { fetchProviders, submitTempChat } from '../services'
import { useChatStore } from '../store'
import { KnowledgeBaseSelector } from './KnowledgeBaseSelector'
import { ProviderSelector } from './ProviderSelector'
import { QuickActions } from './QuickActions'

interface ChatTempHomeProps {
  tabId: string
}

export function ChatTempHome({ tabId }: ChatTempHomeProps) {
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedKbId, setSelectedKbId] = useState<string | null>(null)

  const {
    availableProviders,
    selectedProviderKey,
    isInitLoading,
    initError,
    setSelectedProviderKey,
  } = useChatStore()

  const handleSelectKb = useCallback((kbId: string | null) => {
    setSelectedKbId(kbId)
  }, [])

  const handleSubmit = useCallback(
    async (content: string) => {
      if (isLoading) return
      setIsLoading(true)
      try {
        await submitTempChat(content, tabId, {
          knowledgeBaseIds: selectedKbId ? [selectedKbId] : undefined,
        })
      } finally {
        setIsLoading(false)
      }
    },
    [isLoading, tabId, selectedKbId],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        const trimmed = inputValue.trim()
        if (!trimmed) return
        handleSubmit(trimmed)
      }
    },
    [inputValue, handleSubmit],
  )

  return (
    <XProvider>
      <div className="flex h-full flex-col items-center justify-center bg-surface-secondary px-4">
        <div className="flex w-full max-w-[760px] flex-col items-center gap-8">
          {/* 图标 + 标题 */}
          <div className="flex h-[58px] w-[58px] items-center justify-center rounded-2xl border border-border-default bg-surface-1 shadow-sm">
            <Sparkles className="h-[26px] w-[26px] text-brand-blue" />
          </div>

          <h1 className="text-center text-[34px] font-medium leading-tight text-text-primary">
            今天想从知识库里理解什么？
          </h1>

          {/* 输入区 */}
          <div className="flex w-full flex-col gap-[18px] rounded-3xl border border-border-default bg-surface-1 p-5 shadow-md">
            <Textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="询问、总结或让 AI 帮你整理桌面资料..."
              className="min-h-[60px] resize-none border-0 bg-transparent text-base text-text-primary placeholder:text-text-tertiary shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              disabled={isLoading}
            />

            <div className="flex items-end justify-between">
              <div className="flex items-center gap-2.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-[34px] w-[34px] rounded-xl bg-surface-2 text-text-secondary hover:bg-surface-3"
                  title="添加附件"
                  onClick={() => {}}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>

                <KnowledgeBaseSelector
                  selectedId={selectedKbId}
                  onSelect={handleSelectKb}
                  disabled={isLoading}
                />
                <ProviderSelector
                  providers={availableProviders}
                  selectedKey={selectedProviderKey}
                  onChange={setSelectedProviderKey}
                  disabled={isLoading || isInitLoading}
                />
              </div>

              <Button
                size="icon"
                className="h-[38px] w-[38px] rounded-2xl bg-brand-blue text-white hover:bg-brand-blue/90 disabled:opacity-50"
                onClick={() => {
                  const trimmed = inputValue.trim()
                  if (!trimmed) return
                  handleSubmit(trimmed)
                }}
                disabled={!inputValue.trim() || isLoading}
                data-testid="temp-send-btn"
              >
                <Send className="h-[17px] w-[17px]" />
              </Button>
            </div>
          </div>

          {/* 初始化错误提示 */}
          {initError && (
            <div
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-error/20 bg-error/5 px-4 py-2 text-sm text-error"
              data-testid="init-error-banner"
            >
              <span>模型列表加载失败：{initError}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => fetchProviders()}
                className="text-brand-primary hover:bg-brand-primary/10"
              >
                重试
              </Button>
            </div>
          )}

          {/* 快捷操作 */}
          <QuickActions onAction={handleSubmit} disabled={isLoading} />
        </div>
      </div>
    </XProvider>
  )
}
