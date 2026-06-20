import { createFileRoute } from '@tanstack/react-router'
import { ChatPageByTab } from '@/features/chat/components/ChatPageByTab'
import { ROUTES_REGISTER } from '@/router-register'
import { tabManager } from '@/stores/tabManager'
import { useWorkspaceStore } from '@/stores/workspace.store'

/**
 * 聊天模块路由入口。
 *
 * 文件路由约定：TanStack Router 会根据路径 `/_authenticated/chat/$tabId` 自动生成匹配规则。
 * 每个 chat 页面对应 workspace 中的一个 tab 实例，tabId 是 workspaceStore 中 tabs 数组的标识。
 *
 * 进入页面前（beforeLoad）会先自愈：如果用户直接访问 URL 或本地持久化数据丢失导致 tabs 中
 * 找不到该 tabId，则调用 tabManager.ensureChatTab 补一个空白 chat tab，避免页面直接白屏。
 */
export const Route = createFileRoute('/_authenticated/chat/$tabId')({
  beforeLoad: ({ params }) => {
    // 直接读取 workspaceStore，不触发 React hook（beforeLoad 不是组件生命周期）
    const tab = useWorkspaceStore.getState().tabs.find((t) => t.id === params.tabId)
    if (!tab) {
      // 仅恢复 tab 数据，不触发导航；渲染阶段由 ChatPageByTab 根据 tab 状态决定展示临时首页还是会话页
      tabManager.ensureChatTab(params.tabId)
    }
  },
  component: ChatPageByTabWrapper,
  staticData: {
    meta: ROUTES_REGISTER.chat,
  },
  // 路由级错误兜底：beforeLoad 或 component 抛异常时展示，避免白屏
  errorComponent: ({ error }) => {
    return (
      <div className="flex h-full items-center justify-center text-red-500">
        加载失败: {error instanceof Error ? error.message : '未知错误'}
      </div>
    )
  },
})

function ChatPageByTabWrapper() {
  const { tabId } = Route.useParams()
  return <ChatPageByTab tabId={tabId} />
}
