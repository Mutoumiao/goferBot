import { useState, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Sparkles, Paperclip, Database, Send, FileText, FolderSearch, WandSparkles } from 'lucide-react'
import { useTabsStore } from '@/stores/tabs'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { createChatSession } from '../services'

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

export function ChatHome() {
  const navigate = useNavigate()
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const addTabByRoute = useTabsStore((s) => s.addTabByRoute)

  const startChat = useCallback(
    async (initialMessage?: string) => {
      if (isLoading) return
      setIsLoading(true)

      try {
        const newSession = await createChatSession()
        if (!newSession?.id) {
          setIsLoading(false)
          return
        }

        const route = `/app/chat/${newSession.id}`
        addTabByRoute(route, newSession.title || '新对话', newSession.id)

        if (initialMessage?.trim()) {
          sessionStorage.setItem(`pending_message_${newSession.id}`, initialMessage.trim())
        }

        navigate({ to: route })
      } finally {
        setIsLoading(false)
      }
    },
    [addTabByRoute, navigate, isLoading],
  )

  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim()
    if (!trimmed) return
    startChat(trimmed)
  }, [inputValue, startChat])

  const handleQuickAction = useCallback(
    (prompt: string) => {
      startChat(prompt)
    },
    [startChat],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

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
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
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
                onClick={() => {
                  // TODO: 文件上传功能
                }}
              >
                <Paperclip className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="h-[34px] gap-1.5 rounded-[14px] bg-[#F4F5F7] px-3 text-[#5E6673] hover:bg-[#EBECF0]"
                onClick={() => {
                  // TODO: 知识库选择
                }}
              >
                <Database className="h-[15px] w-[15px]" />
                <span className="text-[13px]">全部知识库</span>
              </Button>
            </div>

            <Button
              size="icon"
              className="h-[38px] w-[38px] rounded-2xl bg-[#5B7CFA] text-white hover:bg-[#4A6BE8] disabled:opacity-50"
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
            >
              <Send className="h-[17px] w-[17px]" />
            </Button>
          </div>
        </div>

        <div className="flex w-full gap-[18px]">
          {QUICK_ACTIONS.map((action) => (
            <Button
              key={action.id}
              variant="ghost"
              onClick={() => handleQuickAction(action.prompt)}
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
