import { useConversationStore } from '@/stores/conversation.store'

/** 旧 Tab 工作区 persist 键；登出时清理，避免脏数据干扰 */
const LEGACY_WORKSPACE_STORAGE_KEY = 'gofer-workspace-v1'

/**
 * 登出 / 换账号时清理与用户相关的 client 状态。
 * Keep-Alive 在 full page reload 时自然清空；SPA 内由调用方配合 destroyAll。
 */
export function clearUserClientState(): void {
  try {
    sessionStorage.removeItem(LEGACY_WORKSPACE_STORAGE_KEY)
  } catch {
    // ignore
  }
  try {
    useConversationStore.getState().reset()
  } catch {
    // ignore
  }
}
