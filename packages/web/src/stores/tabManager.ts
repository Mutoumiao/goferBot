import { router } from '@/router'
import { getRouteMeta, getTabPath, ROUTES_REGISTER, type TabRouteKey } from '@/router-register'
import { useWorkspaceStore } from '@/stores/workspace.store'

const DEFAULT_CHAT_TITLE = '新会话'

export const tabManager = {
  /**
   * 通用路由打开入口。
   * - 单例路由（singleton=true）：查找已有标签，存在则切换，不存在则新建。
   * - 多例路由（singleton=false）：每次新建标签。
   */
  async openRoute(key: TabRouteKey, options?: { title?: string; skipNavigation?: boolean }) {
    const meta = getRouteMeta(key)
    const workspace = useWorkspaceStore.getState()

    if (meta.singleton) {
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

    if (!result.nextTab) {
      await this.openNewChat()
      return
    }

    await router.navigate({ to: getTabPath(result.nextTab) })
  },
}
