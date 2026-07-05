import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { useEffect } from 'react'
import { IconSidebar } from '@/components/sidebar/Sidebar'
import { TabBar } from '@/components/tab-bar/TabBar'
import { TabRouteSync } from '@/components/tab-bar/TabRouteSync'
import { ROUTES_REGISTER } from '@/router-register'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { waitForAuthInit } from '@/utils/wait-for-init'

const FONT_SIZE_MAP: Record<number, string> = {
  1: '12px',
  2: '13px',
  3: '14px',
  4: '15px',
  5: '16px',
}

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async () => {
    const authed = await waitForAuthInit()
    const user = useAuthStore.getState().user
    if (!authed || !user) {
      throw redirect({ to: ROUTES_REGISTER.login.path })
    }
  },
  component: AppLayout,
})

const VALID_THEMES = new Set(['light', 'dark'])

function resolveTheme(appearance: unknown): 'light' | 'dark' {
  if (appearance === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  // ponytail: 防止持久化数据污染导致 appearance 为非字符串对象
  return typeof appearance === 'string' && VALID_THEMES.has(appearance)
    ? (appearance as 'light' | 'dark')
    : 'light'
}

function useAppearanceEffect() {
  const appearance = useSettingsStore((s) => s.config.appearance)
  const fontSizeLevel = useSettingsStore((s) => s.config.fontSizeLevel)

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(resolveTheme(appearance))
  }, [appearance])

  useEffect(() => {
    document.documentElement.style.fontSize = FONT_SIZE_MAP[fontSizeLevel] || '14px'
  }, [fontSizeLevel])
}

function AppLayout() {
  useAppearanceEffect()

  return (
    <div className="flex h-screen bg-surface-2">
      <IconSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TabRouteSync />
        <TabBar />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
