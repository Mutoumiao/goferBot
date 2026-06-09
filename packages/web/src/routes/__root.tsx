import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { configResponsive } from 'ahooks'

import { OverlayHost } from '@/overlays/host/OverlayHost'
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

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        {/* Overlay Portal 系统 — 所有 Dialog/ContextMenu 渲染在此 */}
        <OverlayHost />
        <TanStackDevtools
          config={{ position: 'bottom-right' }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
