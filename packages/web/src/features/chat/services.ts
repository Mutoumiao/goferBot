import type { Message } from '@goferbot/data'
import {
  getSessions,
  createSession as apiCreateSession,
  deleteSession as apiDeleteSession,
  renameSession as apiRenameSession,
  getHistory,
} from '@/api/chat'
import { useChatStore } from './store'

export async function loadChatSessions() {
  const { setSessions, setIsLoadingSessions, setError } = useChatStore.getState()
  setIsLoadingSessions(true)
  setError(null)
  try {
    const res = await getSessions().send()
    setSessions(res.sessions ?? [])
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
  const { setMessages, setIsLoadingHistory } = useChatStore.getState()
  setIsLoadingHistory(true)
  try {
    const res = await getHistory(sessionId).send()
    if (res.messages) {
      setMessages(res.messages as Message[])
    }
  } catch (_e) {
    // 静默处理，避免未捕获的 Promise rejection
  } finally {
    setIsLoadingHistory(false)
  }
}

export async function resolveSessionById(sessionId: string) {
  const { sessions, setActiveSession } = useChatStore.getState()
  const target = sessions.find((s) => s.id === sessionId)
  if (target) {
    setActiveSession(target)
    return target
  }
  await loadChatSessions()
  const refreshed = useChatStore.getState().sessions.find((s) => s.id === sessionId)
  if (refreshed) {
    setActiveSession(refreshed)
    return refreshed
  }
  return undefined
}
