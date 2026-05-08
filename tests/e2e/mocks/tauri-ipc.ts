/**
 * Playwright E2E 测试使用的 Tauri IPC mock。
 * 在 page.addInitScript() 中注入，在所有页面脚本执行之前设置全局变量。
 */

export interface MockInvokeHandlers {
  [cmd: string]: (args?: Record<string, unknown>) => Promise<unknown>
}

const defaultInvokeScript = `
  if (cmd === 'get_sidecar_port') return 11451;
  if (cmd === 'restart_sidecar') return true;
  if (cmd === 'get_app_data_dir') return '/mock/app-data';
  if (cmd === 'import_files') return ['/mock/docs/imported.md'];
  if (cmd === 'read_text_file') return 'mock content';
  if (cmd === 'write_text_file') return true;
  if (cmd === 'open_dialog') return ['/mock/selected/file.md'];
`

function buildOverridesScript(overrides: MockInvokeHandlers): string {
  const lines: string[] = []
  for (const [cmd, fn] of Object.entries(overrides)) {
    // 序列化返回值（只支持简单值）
    const dummy = fn({}).catch(() => undefined)
    lines.push(`// override ${cmd} will be evaluated at runtime`)
  }
  // 使用闭包方式动态调用
  return Object.keys(overrides).length > 0
    ? `
    const __overrides = __TAURI_MOCK_OVERRIDES;
    if (__overrides && __overrides[cmd]) {
      return __overrides[cmd](args);
    }
    `
    : ''
}

/**
 * 生成可在浏览器中直接执行的 mock 脚本字符串。
 */
export function buildMockTauri(overrides: MockInvokeHandlers = {}): { inject: string } {
  const overridesJson = JSON.stringify(
    Object.fromEntries(
      Object.entries(overrides).map(([cmd, fn]) => {
        // 无法直接序列化函数，改用运行时查找表
        return [cmd, true]
      }),
    ),
  )

  const script = `
    (function() {
      window.__TAURI_MOCK_OVERRIDES = ${overridesJson};

      window.__TAURI_INTERNALS__ = window.__TAURI_INTERNALS__ || {};

      window.__TAURI_INTERNALS__.invoke = async function(cmd, args) {
        ${defaultInvokeScript}
        ${buildOverridesScript(overrides)}
        throw new Error('Mock invoke not implemented: ' + cmd);
      };

      window.__TAURI_INTERNALS__.listen = async function(event, handler) {
        if (event === 'sidecar-ready') {
          setTimeout(function() {
            handler({ payload: { port: 11451 } });
          }, 10);
        }
        if (event === 'sidecar-restarted') {
          setTimeout(function() {
            handler({ payload: { port: 11452 } });
          }, 10);
        }
        return function() {};
      };

      window.__TAURI_INTERNALS__.event = window.__TAURI_INTERNALS__.event || {};
      window.__TAURI_INTERNALS__.event.listen = window.__TAURI_INTERNALS__.listen;
    })();
  `

  return { inject: script }
}

/**
 * 向 Playwright page 注入 Tauri IPC mock。
 * 必须在 page.goto() 之前调用，确保页面脚本执行前全局变量已就绪。
 */
export async function injectMockTauri(
  page: any,
  overrides?: MockInvokeHandlers,
): Promise<void> {
  const { inject } = buildMockTauri(overrides)
  await page.addInitScript({ content: inject })
}
