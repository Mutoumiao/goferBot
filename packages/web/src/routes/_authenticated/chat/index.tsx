import { createFileRoute, redirect } from '@tanstack/react-router'
import { ROUTES_REGISTER } from '@/router-register'
import { tabManager } from '@/stores/tabManager'

/**
 * /chat 入口路由。
 *
 * 由于实际的聊天页面路径为 /chat/$tabId，直接访问 /chat（无 tabId）时
 * 需要先确定要打开的标签，再跳转到 /chat/$tabId。
 *
 * 策略：优先复用已存在的空白首页标签，否则新建一个标签，
 * 通过 throw redirect 跳转到 /chat/$tabId，保证地址栏始终带有 tabId。
 */
export const Route = createFileRoute('/_authenticated/chat/')({
  beforeLoad: async () => {
    const tab = await tabManager.openRoute(ROUTES_REGISTER.chat.key, { skipNavigation: true })
    if (tab.id) {
      throw redirect({
        to: ROUTES_REGISTER.chat.path,
        params: { tabId: tab.id },
      })
    }
  },
  component: () => null,
})
