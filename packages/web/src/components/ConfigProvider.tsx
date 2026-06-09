/**
 * 顶层配置提供者 — 预留主题/国际化/全局配置注入点。
 * 当前仅透传 children，后续可在此扩展 ThemeProvider / I18nProvider。
 */
export function ConfigProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
