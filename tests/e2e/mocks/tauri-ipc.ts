/**
 * Playwright E2E 测试使用的 Tauri IPC mock。
 * 在 page.evaluate() 中注入，模拟 Rust 端的 invoke 和 event.listen 行为。
 */

export interface MockInvokeHandlers {
  [cmd: string]: (args?: Record<string, unknown>) => Promise<unknown>
}

export interface MockEventHandlers {
  [event: string]: Array<(payload: unknown) => void>
}

const defaultHandlers: MockInvokeHandlers = {
  async get_sidecar_port() {
    return 11451
  },

  async restart_sidecar() {
    return true
  },

  async get_app_data_dir() {
    return '/mock/app-data'
  },

  async import_files(args: Record<string, unknown>) {
    return [`/mock/docs/${(args?.targetPath as string) || ''}/imported.md`]
  },

  async read_text_file(args: Record<string, unknown>) {
    return `mock content of ${args?.filePath}`
  },

  async write_text_file() {
    return true
  },

  async open_dialog() {
    return ['/mock/selected/file.md']
  },
}

export function buildMockTauri(
  overrides: MockInvokeHandlers = {},
): { inject: string } {
  const handlers = { ...defaultHandlers, ...overrides }

  const script = `
    window.__TAURI_INTERNALS__ = window.__TAURI_INTERNALS__ || {};
    window.__TAURI_INTERNALS__.invoke = async (cmd, args = {}) => {
      const handlers = ${JSON.stringify(Object.keys(handlers))};
      const fnMap = {
        ${Object.entries(handlers)
          .map(
            ([cmd]) => `
          ${JSON.stringify(cmd)}: ${handlers[cmd].toString()}`,
          )
          .join(',')}
      };
      if (fnMap[cmd]) {
        return fnMap[cmd](args);
      }
      throw new Error('Mock invoke not implemented: ' + cmd);
    };
    window.__TAURI_INTERNALS__.listen = async (event, handler) => {
      if (event === 'sidecar-ready') {
        setTimeout(() => handler({ payload: { port: 11451 } }), 50);
      }
      return () => {};
    };
  `

  return { inject: script }
}

/**
 * Playwright page 使用的辅助函数
 * 用法：
 *   await page.addInitScript({ content: buildMockTauri().inject })
 */
export async function injectMockTauri(
  page: any,
  overrides?: MockInvokeHandlers,
): Promise<void> {
  const { inject } = buildMockTauri(overrides)
  await page.addInitScript({ content: inject })
}
