import { createFileRoute, redirect, useRouterState } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { WorkspaceStage } from '@/components/layout/WorkspaceStage'
import { IconSidebar } from '@/components/sidebar/Sidebar'
import { destroyAllKeepAliveCaches, KeepAliveProvider, useKeepAlive } from '@/lib/route-keepalive'
import { KeepAliveOutlet } from '@/lib/route-keepalive-outlet'
import { closeAll } from '@/overlays/services/overlay-service'
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
    // 以 isAuthenticated 为准（/auth/me 成功后才为 true）；
    // 禁止仅凭 localStorage 缓存的 user 放行
    if (!authed || !useAuthStore.getState().isAuthenticated) {
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

/**
 * 暴露 destroyAll 给登出等跨组件场景。
 * 登录页不在 Provider 内，full page reload 会自然清空缓存。
 */
function KeepAliveBridge() {
  const { destroyAll } = useKeepAlive()

  useEffect(() => {
    window.__goferKeepAliveDestroyAll = () => {
      destroyAll()
      destroyAllKeepAliveCaches()
    }
    return () => {
      delete window.__goferKeepAliveDestroyAll
    }
  }, [destroyAll])

  return null
}

/** 一级 path 切换时关闭全部 Overlay，避免 Companion 弹层跨页残留 */
function OverlayRouteCleanup() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const prevPathRef = useRef(pathname)

  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      prevPathRef.current = pathname
      closeAll()
    }
  }, [pathname])

  return null
}

function AppLayout() {
  useAppearanceEffect()

  return (
    <KeepAliveProvider>
      {/*
        70px 图标轨 | 右侧舞台（灰底 padding + 业务白卡壳 / 设置透明）
      */}
      <div className="flex h-screen bg-canvas" data-testid="app-shell">
        <IconSidebar />
        <WorkspaceStage>
          <KeepAliveBridge />
          <OverlayRouteCleanup />
          <KeepAliveOutlet />
        </WorkspaceStage>
      </div>
    </KeepAliveProvider>
  )
}

declare global {
  interface Window {
    __goferKeepAliveDestroyAll?: () => void
  }
}
