import type { Message, Session } from '@goferbot/data'
import {
  createSession as apiCreateSession,
  deleteSession as apiDeleteSession,
  renameSession as apiRenameSession,
  getChatProviders,
  getMessages,
  getSessionById,
  getSessions,
} from '@/api/chat'
import { xChatRequest } from '@/api/x-chat'
import { DeleteSessionDialog } from '@/overlays/dialogs/DeleteSessionDialog'
import { openDialog } from '@/overlays/services/overlay-service'
import { useConversationStore } from '@/stores/conversation.store'
import { useWorkspaceStore } from '@/stores/workspace.store'
import { getPendingMessageKey } from './constants'
import { GoferChatProvider } from './providers/GoferChatProvider'
import { useChatStore } from './store'

export async function loadChatSessions() {
  const { setSessions, setIsLoadingSessions, setError } = useChatStore.getState()
  setIsLoadingSessions(true)
  setError(null)
  try {
    const res = await getSessions().send()
    setSessions(res.items ?? [])
  } catch (e) {
    setError(e instanceof Error ? e.message : '加载会话列表失败')
  } finally {
    setIsLoadingSessions(false)
  }
}

export async function createChatSession() {
  const { addSession, setActiveSession, setIsLoadingSessions, setError } = useChatStore.getState()
  setIsLoadingSessions(true)
  setError(null)
  try {
    const newSession = await apiCreateSession().send()
    addSession(newSession)
    setActiveSession(newSession)
    return newSession
  } catch (e) {
    setError(e instanceof Error ? e.message : '创建会话失败')
    return undefined
  } finally {
    setIsLoadingSessions(false)
  }
}

export async function renameChatSession(id: string, title: string) {
  const { updateSession, setIsLoadingSessions, setError } = useChatStore.getState()
  if (!title.trim()) return
  setIsLoadingSessions(true)
  setError(null)
  try {
    await apiRenameSession(id, title).send()
    updateSession(id, { title })
  } catch (e) {
    setError(e instanceof Error ? e.message : '重命名失败')
  } finally {
    setIsLoadingSessions(false)
  }
}

export async function deleteChatSession(id: string) {
  const { removeSession, activeSession, setActiveSession, setIsLoadingSessions, setError } =
    useChatStore.getState()
  setIsLoadingSessions(true)
  setError(null)
  try {
    await apiDeleteSession(id).send()
    removeSession(id)
    if (activeSession?.id === id) {
      setActiveSession(null)
    }
  } catch (e) {
    setError(e instanceof Error ? e.message : '删除会话失败')
  } finally {
    setIsLoadingSessions(false)
  }
}

export async function loadChatHistory(sessionId: string) {
  const { setIsLoadingHistory, setError } = useChatStore.getState()
  const { setMessages } = useConversationStore.getState()
  setIsLoadingHistory(true)
  setError(null)
  try {
    const res = await getMessages(sessionId).send()
    if (res.items) {
      setMessages(sessionId, res.items as Message[])
    }
  } catch (e) {
    setError(e instanceof Error ? e.message : '加载历史消息失败')
  } finally {
    setIsLoadingHistory(false)
  }
}

/**
 * 直接根据会话 ID 获取会话详情，不依赖本地会话列表缓存
 * 用于单会话页面加载，避免调用 getSessions 全量列表
 */
export async function resolveSessionById(sessionId: string): Promise<Session | undefined> {
  const { setActiveSession, setError } = useChatStore.getState()
  try {
    const session = await getSessionById(sessionId).send()
    setActiveSession(session)
    return session
  } catch (e) {
    setError(e instanceof Error ? e.message : '加载会话失败')
    return undefined
  }
}

export async function deleteChatSessionWithReload(id: string, options?: { onReload?: () => void }) {
  await deleteChatSession(id)
  options?.onReload?.()
}

export async function confirmDeleteChatSession(
  session: { id: string; title?: string },
  options?: {
    onBefore?: () => void
    onAfter?: () => void
    onReload?: () => void
  },
): Promise<boolean> {
  const result = await openDialog<'confirm' | undefined>(DeleteSessionDialog, {
    sessionTitle: session.title || '未命名会话',
  })
  if (result !== 'confirm') return false
  options?.onBefore?.()
  try {
    await deleteChatSessionWithReload(session.id, { onReload: options?.onReload })
    return true
  } finally {
    options?.onAfter?.()
  }
}

/** 创建 GoferChatProvider 实例 — 由 services 层组装，保持 API 集中管理 */
export function createGoferProvider() {
  return new GoferChatProvider({
    request: xChatRequest,
  })
}

/**
 * 临时会话 pending message 结构。
 * 旧版本使用纯文本存储，读取处做兼容处理。
 */
export interface PendingMessage {
  content: string
  knowledgeBaseIds?: string[]
}

/**
 * 业务编排：临时会话提交 → 创建真实会话 → 持久化 pending message → 返回新会话 ID
 * 组件只需调用此函数并执行导航
 */
export async function submitTempChat(
  content: string,
  tabId: string,
  options?: { knowledgeBaseIds?: string[] },
): Promise<string | null> {
  const newSession = await createChatSession()
  if (!newSession?.id) return null
  const pending: PendingMessage = {
    content: content.trim(),
    knowledgeBaseIds: options?.knowledgeBaseIds,
  }
  sessionStorage.setItem(getPendingMessageKey(newSession.id), JSON.stringify(pending))

  // 更新当前 tab 的 conversationId 与标题，不再替换路由
  const workspace = useWorkspaceStore.getState()
  workspace.updateTab(tabId, {
    conversationId: newSession.id,
    title: newSession.title,
  })

  return newSession.id
}

/**
 * 业务编排：加载模型 providers 列表
 * 只在首次加载（store 中无数据）时请求，避免每次进入 chat 页面重复调用
 */
export async function fetchProviders(): Promise<void> {
  const store = useChatStore.getState()
  // 若已加载过 providers，不再重复请求
  if (store.availableProviders.length > 0) return
  if (store.isInitLoading) return
  store.setIsInitLoading(true)
  store.setInitError(null)
  try {
    const res = await getChatProviders().send()
    const providers = res?.providers ?? []
    store.setAvailableProviders(providers)
  } catch (e) {
    store.setInitError(e instanceof Error ? e.message : '初始化失败')
  } finally {
    store.setIsInitLoading(false)
  }
}
