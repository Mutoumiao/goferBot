import { ConfigProvider as AntConfigProvider, App, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import type { ReactNode } from 'react'
import { type AppearanceMode, useSettingsStore } from '@/stores/settings'

function resolveAntTheme(appearance: AppearanceMode) {
  if (appearance === 'dark') {
    return {
      algorithm: theme.darkAlgorithm,
      token: {
        colorPrimary: '#4f46e5',
        borderRadius: 8,
      },
    }
  }
  return {
    algorithm: theme.defaultAlgorithm,
    token: {
      colorPrimary: '#4f46e5',
      borderRadius: 8,
    },
  }
}

export function ConfigProvider({ children }: { children: ReactNode }) {
  const appearance = useSettingsStore((s) => s.appearance)
  const isDark =
    appearance === 'dark' ||
    (appearance === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)

  const resolvedTheme = resolveAntTheme(isDark ? 'dark' : 'light')

  return (
    <AntConfigProvider theme={resolvedTheme} componentSize="middle" locale={zhCN}>
      <App>{children}</App>
    </AntConfigProvider>
  )
}
