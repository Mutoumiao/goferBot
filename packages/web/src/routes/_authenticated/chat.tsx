import { createFileRoute, Outlet } from '@tanstack/react-router'

/**
 * /chat 布局路由。
 *
 * 作为 /chat 与 /chat/$tabId 的公共父级，承载 Outlet。
 * 具体逻辑见 chat/index.tsx（/chat）与 chat/$tabId.tsx（/chat/$tabId）。
 */
export const Route = createFileRoute('/_authenticated/chat')({
  component: ChatLayout,
})

function ChatLayout() {
  return <Outlet />
}
