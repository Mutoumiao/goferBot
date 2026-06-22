import { createRootRoute, HeadContent, Scripts } from '@tanstack/react-router'
import { Toaster } from 'sonner'
import { useEffect } from 'react'
import { ConfigProvider } from '@/components/ConfigProvider'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import appCss from '../globals.css?url'

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
      { title: 'GoferBot Admin' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  notFoundComponent: NotFound,
  shellComponent: RootDocument,
})

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const hydrated = useAuthStore((s) => s._hydrated)
  const appearance = useSettingsStore((s) => s.appearance)

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    const isDark =
      appearance === 'dark' ||
      (appearance === 'system' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches)
    root.classList.add(isDark ? 'dark' : 'light')
  }, [appearance])

  useEffect(() => {
    if (!hydrated || useAuthStore.getState().isInitialized) return
    const token = useAuthStore.getState().token
    if (token) {
      useAuthStore.getState().setInitialized(true)
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
        <ConfigProvider>
          <AuthInitializer>{children}</AuthInitializer>
          <Toaster position="top-right" richColors closeButton toastOptions={{ duration: 3500 }} />
        </ConfigProvider>
        <Scripts />
      </body>
    </html>
  )
}
