import type { Message, ModelProvider, ProviderListItem, Session } from '@goferbot/data'
import {
  createSession as apiCreateSession,
  deleteSession as apiDeleteSession,
  renameSession as apiRenameSession,
  getChatProviders,
  getMessages,
  getSessionById,
  getSessions,
} from '@/api/chat'
import { DeleteSessionDialog } from '@/overlays/dialogs/DeleteSessionDialog'
import { openDialog } from '@/overlays/services/overlay-service'
import { useConversationStore } from '@/stores/conversation.store'
import { getPendingMessageKey } from './constants'
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
  setError(null)
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

/**
 * 临时会话 pending message 结构。
 * 旧版本使用纯文本存储，读取处做兼容处理。
 */
export interface PendingMessage {
  content: string
  knowledgeBaseIds?: string[]
}

/**
 * 业务编排：临时会话提交 → 创建真实会话 → 持久化 pending message → 返回 Session.id
 * 调用方负责 setSelectedSessionId(sessionId)（本地状态，不写 URL）
 */
export async function submitTempChat(
  content: string,
  options?: { knowledgeBaseIds?: string[] },
): Promise<string | null> {
  const newSession = await createChatSession()
  if (!newSession?.id) return null
  const pending: PendingMessage = {
    content: content.trim(),
    knowledgeBaseIds: options?.knowledgeBaseIds,
  }
  sessionStorage.setItem(getPendingMessageKey(newSession.id), JSON.stringify(pending))
  return newSession.id
}

/** 模块级 in-flight，多组件 mount 同帧只发一次 providers 请求 */
let providersInflight: Promise<void> | null = null

/**
 * 业务编排：加载模型 providers 列表
 * - 已成功加载则跳过（force 可强制重拉）
 * - in-flight 合并，避免 ChatsPage + ChatSessionPanel 等同帧双请求
 *
 * 后端 /settings/chat/providers 返回 provider 级别 { builtIn, custom }，
 * 每个 provider 含 models 数组。此处展开为模型级别条目（key = {providerId}#{modelName}），
 * 仅包含 enabled 的 LLM 模型。
 */
export async function fetchProviders(options?: { force?: boolean }): Promise<void> {
  const store = useChatStore.getState()
  if (!options?.force && store.availableProviders.length > 0) return
  if (providersInflight) return providersInflight

  providersInflight = (async () => {
    const s = useChatStore.getState()
    s.setIsInitLoading(true)
    s.setInitError(null)
    try {
      const res = await getChatProviders().send()
      // 兼容 { data: { builtIn, custom } } 已被 alova 解包 / 未解包两种情况
      const payload =
        res && typeof res === 'object' && 'builtIn' in res
          ? res
          : ((res as { data?: { builtIn?: ModelProvider[]; custom?: ModelProvider[] } })?.data ??
            {})
      const toListItems = (providers: ModelProvider[], isBuiltin: boolean): ProviderListItem[] =>
        (providers ?? []).flatMap((p) => {
          if (!p || p.enabled === false) return []
          const models = Array.isArray(p.models) ? p.models : []
          return models
            .filter((m) => {
              if (!m?.name) return false
              // type 缺省按 llm；enabled 缺省视为 true（后端 zod default 可能被序列化省略）
              const type = m.type ?? 'llm'
              const enabled = m.enabled !== false
              return type === 'llm' && enabled
            })
            .map((m) => ({
              key: `${p.id}#${m.name}`,
              name: p.name || p.id,
              model: m.name,
              isBuiltin,
            }))
        })
      const items = [
        ...toListItems(payload.builtIn ?? [], true),
        ...toListItems(payload.custom ?? [], false),
      ]
      s.setAvailableProviders(items)
    } catch (e) {
      s.setInitError(e instanceof Error ? e.message : '初始化失败')
    } finally {
      s.setIsInitLoading(false)
      providersInflight = null
    }
  })()

  return providersInflight
}
