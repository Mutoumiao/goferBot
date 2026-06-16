import { router } from '@/router'
import { getRouteMeta, getTabPath, ROUTES_REGISTER, type TabRouteKey } from '@/router-register'
import { useWorkspaceStore } from '@/stores/workspace.store'

const DEFAULT_CHAT_TITLE = '新会话'

function findHomeChatTab() {
  const workspace = useWorkspaceStore.getState()
  return workspace.tabs.find((t) => t.type === ROUTES_REGISTER.chat.key && !t.conversationId) ?? null
}

export const tabManager = {
  /**
   * 通用路由打开入口。
   * - 单例路由（singleton=true）：查找已有标签，存在则切换，不存在则新建。
   * - 多例路由（singleton=false）：每次新建标签。
   *
   * chat 路由特殊处理：未绑定会话的空白首页作为单例复用；
   * 已绑定 conversationId 的会话页作为多例标签。
   */
  async openRoute(key: TabRouteKey, options?: { title?: string; skipNavigation?: boolean }) {
    const meta = getRouteMeta(key)
    const workspace = useWorkspaceStore.getState()

    if (key === ROUTES_REGISTER.chat.key) {
      const existing = findHomeChatTab()
      if (existing) {
        workspace.switchTab(existing.id)
        if (!options?.skipNavigation) {
          await router.navigate({ to: getTabPath(existing) })
        }
        return existing
      }
    } else if (meta.singleton) {
      const existing = workspace.findTabByType(key)
      if (existing) {
        workspace.switchTab(existing.id)
        if (!options?.skipNavigation) {
          await router.navigate({ to: getTabPath(existing) })
        }
        return existing
      }
    }

    const tab = workspace.addTab({
      type: key,
      title: options?.title ?? meta.title,
      closable: meta.closable,
    })

    const target = meta.bindTo ? meta.bindTo(tab.id) : meta.path
    if (!options?.skipNavigation) {
      await router.navigate({ to: target })
    }
    return tab
  },

  async openNewChat(options?: { skipNavigation?: boolean }) {
    return this.openRoute(ROUTES_REGISTER.chat.key, {
      title: DEFAULT_CHAT_TITLE,
      skipNavigation: options?.skipNavigation,
    })
  },

  /**
   * 确保指定 tabId 的 chat 标签存在。
   * 用于直接访问 /chat/$tabId 但本地无该标签数据时的自愈恢复。
   * 注：仅恢复标签数据，不触发导航，由调用方负责路由同步。
   */
  ensureChatTab(tabId: string) {
    const workspace = useWorkspaceStore.getState()
    if (workspace.tabs.some((t) => t.id === tabId)) return
    workspace.addTab({
      id: tabId,
      type: ROUTES_REGISTER.chat.key,
      title: DEFAULT_CHAT_TITLE,
      closable: ROUTES_REGISTER.chat.closable,
    })
  },

  async openConversation(conversationId: string, title?: string) {
    const workspace = useWorkspaceStore.getState()
    const existing = workspace.findTabByConversationId(conversationId)
    if (existing) {
      workspace.switchTab(existing.id)
      await router.navigate({ to: getTabPath(existing) })
      return existing
    }

    const tab = workspace.addTab({
      type: ROUTES_REGISTER.chat.key,
      title: title ?? DEFAULT_CHAT_TITLE,
      conversationId,
      closable: true,
    })
    const meta = getRouteMeta(ROUTES_REGISTER.chat.key)
    await router.navigate({ to: meta.bindTo!(tab.id) })
    return tab
  },

  async openHistory() {
    return this.openRoute(ROUTES_REGISTER.history.key)
  },

  async openKnowledge() {
    return this.openRoute(ROUTES_REGISTER.knowledgeBase.key)
  },

  async switchTab(tabId: string) {
    const workspace = useWorkspaceStore.getState()
    const tab = workspace.tabs.find((t) => t.id === tabId)
    if (!tab) return false
    workspace.switchTab(tabId)
    await router.navigate({ to: getTabPath(tab) })
    return true
  },

  async closeTab(tabId: string) {
    const workspace = useWorkspaceStore.getState()
    const result = workspace.removeTab(tabId)
    if (!result.removed) return

    if (result.nextTab) {
      await router.navigate({ to: getTabPath(result.nextTab) })
      return
    }

    const homeChat = findHomeChatTab()
    if (homeChat) {
      workspace.switchTab(homeChat.id)
      await router.navigate({ to: getTabPath(homeChat) })
      return
    }

    await this.openNewChat()
  },
}
