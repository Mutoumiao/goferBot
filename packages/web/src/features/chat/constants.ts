/**
 * 聊天功能常量配置
 */

/** sessionStorage key 前缀 — pending message 持久化 */
export const PENDING_MSG_KEY_PREFIX = 'pending_msg_'

/** 输入框字数上限 */
export const CHAT_INPUT_MAX_LENGTH = 8000

/** 生成 pending message 的 sessionStorage key */
export function getPendingMessageKey(sessionId: string): string {
  return `${PENDING_MSG_KEY_PREFIX}${sessionId}`
}
