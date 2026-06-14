/**
 * 聊天功能常量配置
 * 集中管理快捷操作、sessionStorage key 等，禁止在组件中硬编码
 */
import { FileText, FolderSearch, WandSparkles } from 'lucide-react'

/** sessionStorage key 前缀 — pending message 持久化 */
export const PENDING_MSG_KEY_PREFIX = 'pending_msg_'

/** 生成 pending message 的 sessionStorage key */
export function getPendingMessageKey(sessionId: string): string {
  return `${PENDING_MSG_KEY_PREFIX}${sessionId}`
}

/** 快捷操作配置 */
export const QUICK_ACTIONS = [
  {
    id: 'summarize',
    icon: FileText,
    iconColor: 'text-info',
    iconBg: 'bg-brand-blue-soft',
    title: '总结文档',
    caption: '提炼重点与行动项',
    prompt: '请帮我总结这份文档的重点内容和行动项',
  },
  {
    id: 'search',
    icon: FolderSearch,
    iconColor: 'text-success',
    iconBg: 'bg-success/10',
    title: '查找资料',
    caption: '跨知识库引用来源',
    prompt: '请在知识库中查找相关资料并引用来源',
  },
  {
    id: 'note',
    icon: WandSparkles,
    iconColor: 'text-brand-secondary',
    iconBg: 'bg-brand-secondary/10',
    title: '生成笔记',
    caption: '把零散信息变成结构',
    prompt: '请帮我把这些信息整理成结构化的笔记',
  },
] as const


