import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { useEffect } from 'react'
import { ConfigProvider } from '@/components/ConfigProvider'
import { IconSidebar } from '@/components/sidebar/Sidebar'
import { TabBar } from '@/components/tab-bar/TabBar'
import { TabRouteSync } from '@/components/tab-bar/TabRouteSync'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'

const FONT_SIZE_MAP: Record<number, string> = {
  1: '12px',
  2: '13px',
  3: '14px',
  4: '15px',
  5: '16px',
}

function waitForInit(maxMs = 2000): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now()
    const check = () => {
      if (useAuthStore.getState().isInitialized) {
        resolve()
        return
      }
      if (Date.now() - start > maxMs) {
        resolve()
        return
      }
      setTimeout(check, 50)
    }
    check()
  })
}

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async () => {
    await waitForInit()
    const token = useAuthStore.getState().token
    if (!token) {
      throw redirect({ to: '/login' })
    }
  },
  component: AppLayout,
})

function useAppearanceEffect() {
  const appearance = useSettingsStore((s) => s.config.appearance)
  const fontSizeLevel = useSettingsStore((s) => s.config.fontSizeLevel)

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')

    if (appearance === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.add(prefersDark ? 'dark' : 'light')
    } else {
      root.classList.add(appearance)
    }
  }, [appearance])

  useEffect(() => {
    document.documentElement.style.fontSize = FONT_SIZE_MAP[fontSizeLevel] || '14px'
  }, [fontSizeLevel])
}

function AppLayout() {
  useAppearanceEffect()

  return (
    <ConfigProvider>
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
    </ConfigProvider>
  )
}
