/**
 * 路由辅助。
 *
 * 注：页内选中态（会话 / 知识库）已迁到 zustand，不再使用 ?c= / ?kb=。
 * 下列 validate* 保留为兼容旧链接的 no-op 解析（一律忽略 search）。
 */

export type ChatsSearch = Record<string, never>
export type KnowledgeBaseSearch = Record<string, never>

/** @deprecated 选中会话已迁 store；忽略 search */
export function validateChatsSearch(_search: Record<string, unknown>): ChatsSearch {
  return {}
}

/** @deprecated 选中知识库已迁 store；忽略 search */
export function validateKnowledgeBaseSearch(_search: Record<string, unknown>): KnowledgeBaseSearch {
  return {}
}

/**
 * 登录 returnUrl 消毒（非路由 redirect 壳）。
 * 已删除的业务 path（/chat*、/history）落到 /chats，避免 returnUrl 指向 404。
 */
export function normalizeAuthLandingPath(path?: string | null): string {
  if (!path || path === '/' || path === '') return '/chats'
  if (path === '/history' || path.startsWith('/history?')) return '/chats'
  if (path === '/chat' || path.startsWith('/chat/') || path.startsWith('/chat?')) return '/chats'
  // 剥离旧 ?c= / ?kb= 查询，统一落到一级路径
  if (path.startsWith('/chats')) return '/chats'
  if (path.startsWith('/knowledgeBase')) return '/knowledgeBase'
  // 已删除的 Companion 二级 path → 一级
  if (path.startsWith('/companions/')) return '/companions'
  return path
}
