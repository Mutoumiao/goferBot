import type { TabType } from '@/types'

export interface TabRouteConfig {
  routeName: string
  tabType: TabType
  singleton: boolean
  defaultTitle: string
}

export const TAB_ROUTE_CONFIG: TabRouteConfig[] = [
  { routeName: 'chat',          tabType: 'chat',         singleton: false, defaultTitle: '新会话' },
  { routeName: 'knowledgeBase', tabType: 'knowledgeBase', singleton: true,  defaultTitle: '知识库' },
  { routeName: 'history',       tabType: 'history',       singleton: true,  defaultTitle: '历史记录' },
  { routeName: 'settings',      tabType: 'settings',      singleton: true,  defaultTitle: '设置' },
  { routeName: 'recycleBin',    tabType: 'recycleBin',    singleton: true,  defaultTitle: '回收站' },
]

export function getTabRouteConfig(routeName: string): TabRouteConfig | undefined {
  return TAB_ROUTE_CONFIG.find((c) => c.routeName === routeName)
}
