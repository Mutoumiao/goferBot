import { ConfigProvider as AntConfigProvider, App, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import type { ReactNode } from 'react'
import { type AppearanceMode, useSettingsStore } from '@/stores/settings'

function resolveAntTheme(appearance: AppearanceMode) {
  if (appearance === 'dark') {
    return {
      algorithm: theme.darkAlgorithm,
      token: {
        colorPrimary: '#1890ff',
        colorPrimaryHover: '#40a9ff',
        colorSuccess: '#52c41a',
        colorWarning: '#faad14',
        colorError: '#ff4d4f',
        borderRadius: 8,
        colorBgContainer: '#1f1f1f',
        colorBgLayout: '#141414',
        colorBgHeader: '#1f1f1f',
        colorText: '#ffffff',
        colorTextSecondary: '#bfbfbf',
        colorBorder: '#303030',
        colorBgElevated: '#262626',
      },
    }
  }
  return {
    algorithm: theme.defaultAlgorithm,
    token: {
      colorPrimary: '#1890ff',
      colorPrimaryHover: '#40a9ff',
      colorSuccess: '#52c41a',
      colorWarning: '#faad14',
      colorError: '#ff4d4f',
      borderRadius: 8,
      colorBgContainer: '#ffffff',
      colorBgLayout: '#f0f2f5',
      colorBgHeader: '#ffffff',
      colorText: '#1a1a2e',
      colorTextSecondary: '#6c757d',
      colorBorder: '#e5e7eb',
      colorBgElevated: '#ffffff',
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
