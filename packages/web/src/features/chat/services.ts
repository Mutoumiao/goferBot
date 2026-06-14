import type { Message, Session } from '@goferbot/data'
import { redirect } from '@tanstack/react-router'
import {
  getSessions,
  createSession as apiCreateSession,
  deleteSession as apiDeleteSession,
  renameSession as apiRenameSession,
  getMessages,
  getChatProviders,
  getSessionById,
} from '@/api/chat'
import { xChatRequest } from '@/api/x-chat'
import { GoferChatProvider } from './providers/GoferChatProvider'
import { useChatStore } from './store'
import { useTabsStore } from '@/stores/tabs'
import { openDialog } from '@/overlays/services/overlay-service'
import { DeleteSessionDialog } from '@/overlays/dialogs/DeleteSessionDialog'
import { getPendingMessageKey } from './constants'

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
  const { setMessages, setIsLoadingHistory, setError } = useChatStore.getState()
  setIsLoadingHistory(true)
  setError(null)
  try {
    const res = await getMessages(sessionId).send()
    if (res.data) {
      setMessages(res.data as Message[])
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

export async function deleteChatSessionWithReload(
  id: string,
  options?: { onReload?: () => void },
) {
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
 * 业务编排：临时会话提交 → 创建真实会话 → 持久化 pending message → 返回新会话 ID
 * 组件只需调用此函数并执行导航
 */
export async function submitTempChat(content: string): Promise<string | null> {
  const newSession = await createChatSession()
  if (!newSession?.id) return null
  sessionStorage.setItem(getPendingMessageKey(newSession.id), content.trim())

  // 将临时标签升级为真实会话标签
  const tabsStore = useTabsStore.getState()
  const activeTab = tabsStore.activeTab()
  if (activeTab?.isTemp && activeTab.sessionId) {
    tabsStore.promoteTempSession(activeTab.sessionId, newSession.id, newSession.title)
  }

  return newSession.id
}

/**
 * 业务编排：重命名会话 → 同步标签标题
 */
export async function renameSessionAndTab(sessionId: string, title: string): Promise<void> {
  await renameChatSession(sessionId, title)
  const tabsStore = useTabsStore.getState()
  const tab = tabsStore.tabs.find((t) => t.sessionId === sessionId)
  if (tab) {
    tabsStore.renameTab(tab.id, title)
  }
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

/**
 * 业务编排：路由 loader — 解析会话 ID，判断是否临时会话
 * 返回 { sessionId, isTemp } 供路由使用
 *
 * 优化策略：
 * 1. 先检查 tabsStore 中的 tempSessionIds 集合，若 sessionId 在集合中，直接返回临时状态，不发起任何请求
 * 2. 非临时会话时，直接调用 getSessionById 获取会话详情，不依赖分页列表
 * 3. 仅在请求失败时降级到临时状态（会话不存在或权限不足）
 */
export async function resolveSessionForRoute(sessionId: string): Promise<{ sessionId: string; isTemp: boolean; error?: string }> {
  const tabsStore = useTabsStore.getState()

  // 检查 tempSessionIds 集合：只要存在就一定是临时会话，不发起任何请求
  if (tabsStore.isTempSession(sessionId)) {
    return { sessionId, isTemp: true }
  }

  // 非临时会话：直接请求会话详情，不走全量列表查询
  try {
    const session = await getSessionById(sessionId).send()
    if (session) {
      // 同步标签标题
      const tab = tabsStore.tabs.find((t) => t.sessionId === sessionId)
      if (tab && tab.title !== session.title) {
        tabsStore.renameTab(tab.id, session.title)
      }
      // 同时设置激活会话，避免 ChatPage 再次请求
      useChatStore.getState().setActiveSession(session)
      return { sessionId, isTemp: false }
    }
  } catch (e) {
    // 会话不存在或权限不足，直接重定向到首页
    // 不创建临时标签，避免重复请求和页面卡死
    throw redirect({ to: '/' })
  }

  // 请求失败：视为临时会话
  return { sessionId, isTemp: true }
}
