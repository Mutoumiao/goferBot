import { TanStackDevtools } from '@tanstack/react-devtools'
import { createRootRoute, HeadContent, Scripts } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { configResponsive } from 'ahooks'
import { useEffect } from 'react'
import { OverlayHost } from '@/overlays/host/OverlayHost'
import { useAuthStore } from '@/stores/auth'
import { waitForAuthInit } from '@/utils/wait-for-init'
import appCss from '../globals.css?url'

/* ========== ahooks 响应式断点全局配置 ========== */
configResponsive({
  small: 0,
  middle: 800,
  large: 1024,
})

function NotFound() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold text-[#1F2328]">页面未找到</h1>
      <p className="text-sm text-[#9AA3AF]">请求的页面不存在或已被移除</p>
    </div>
  )
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'GoferBot' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  notFoundComponent: NotFound,
  shellComponent: RootDocument,
})

/**
 * 认证初始化闸门
 *
 * - 统一走 waitForAuthInit（single-flight /auth/me + 超时保护）
 * - 失败时禁止 window.location 硬跳转：硬跳转会重置 isInitialized，
 *   而 localStorage 仍保留 user，导致反复请求 /auth/me 死循环
 * - 路由守卫（beforeLoad）负责未登录时 redirect 到 /login
 */
function AuthInitializer({ children }: { children: React.ReactNode }) {
  const hydrated = useAuthStore((s) => s._hydrated)
  const isInitialized = useAuthStore((s) => s.isInitialized)

  useEffect(() => {
    if (!hydrated || useAuthStore.getState().isInitialized) return
    void waitForAuthInit()
  }, [hydrated])

  if (!hydrated || !isInitialized) return null

  return <>{children}</>
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <HeadContent />
      </head>
      <body>
        <AuthInitializer>{children}</AuthInitializer>
        {/* Overlay Portal 系统 — 所有 Dialog/ContextMenu 渲染在此 */}
        <OverlayHost />
        {import.meta.env.DEV && (
          <TanStackDevtools
            config={{ position: 'bottom-right' }}
            plugins={[
              {
                name: 'Tanstack Router',
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
        )}
        <Scripts />
      </body>
    </html>
  )
}
