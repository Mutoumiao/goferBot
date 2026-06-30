import { TanStackDevtools } from '@tanstack/react-devtools'
import { createRootRoute, HeadContent, Scripts } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { configResponsive } from 'ahooks'
import { useEffect } from 'react'
import { fetchCurrentUser } from '@/features/auth/services'
import { OverlayHost } from '@/overlays/host/OverlayHost'
import { ROUTES_REGISTER } from '@/router-register'
import { useAuthStore } from '@/stores/auth'
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

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const hydrated = useAuthStore((s) => s._hydrated)

  useEffect(() => {
    if (!hydrated || useAuthStore.getState().isInitialized) return

    // ponytail: HttpOnly Cookie 由浏览器自动携带；有持久化的 user 则尝试刷新当前会话
    const user = useAuthStore.getState().user
    if (user) {
      fetchCurrentUser().then((ok) => {
        if (!ok) {
          useAuthStore.getState().clearAuth()
          window.location.href = ROUTES_REGISTER.login.path
          return
        }
        useAuthStore.getState().setInitialized(true)
      })
    } else {
      useAuthStore.getState().setInitialized(true)
    }
  }, [hydrated])

  const isInitialized = useAuthStore((s) => s.isInitialized)
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
