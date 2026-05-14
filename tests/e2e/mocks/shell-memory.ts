/**
 * Playwright E2E 测试使用的 Shell mock。
 * 在 page.addInitScript() 中注入，设置全局 MemoryShell。
 */

export interface ShellMockOptions {
  port?: number
  overrides?: {
    importFiles?: boolean
  }
}

export function buildShellMockScript(options: ShellMockOptions = {}): string {
  const port = options.port ?? 11451

  return `
    (function() {
      window.__SHELL_MOCK_PORT__ = ${port};
      window.__SHELL_MOCK_OVERRIDES__ = ${JSON.stringify(options.overrides || {})};
    })();
  `
}

/**
 * 向 Playwright page 注入 Shell mock。
 * 必须在 page.goto() 之前调用。
 */
export async function injectMockShell(
  page: any,
  options?: ShellMockOptions,
): Promise<void> {
  const script = buildShellMockScript(options)
  await page.addInitScript({ content: script })
}
