# Shell 抽象与浏览器模式 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 提取 Shell 模块将前端与 Tauri 解耦，使 Web 应用可在浏览器中独立运行，消除对 `@tauri-apps/api` 的直接依赖。

**Architecture:** 定义 `Shell` 接口，提供 `TauriShell`、`BrowserShell`、`MemoryShell` 三个适配器。通过 Vue provide/inject 全局注入，`useSidecarStatus()` 基于 `useShell()` 重构。运行时通过 `isTauri()` 自动检测环境。

**Tech Stack:** Vue 3 (provide/inject/composables), TypeScript, Vitest, Playwright

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/shell/types.ts` | `Shell` 接口 + `Unlisten` 类型定义 |
| `src/shell/tauri.ts` | `TauriShell` 适配器 — 调用 Tauri IPC |
| `src/shell/browser.ts` | `BrowserShell` 适配器 — 固定端口 + HTML 文件输入 |
| `src/shell/memory.ts` | `MemoryShell` 适配器 — 测试注入，可控响应 |
| `src/shell/index.ts` | `createShell()` + `isTauri()` + `useShell()` + `setShell()` |
| `src/composables/useSidecarStatus.ts` | 重构后的 sidecar 状态管理（原 `useSidecar.ts`） |
| `src/stores/knowledgeBase.ts` | 修改 `importFiles` 改用 `Shell.importFiles` |
| `src/App.vue` | provide Shell 实例 |
| `tests/unit/shell/memory.test.ts` | MemoryShell 单元测试 |
| `tests/unit/composables/useSidecarStatus.test.ts` | useSidecarStatus 重构后测试 |
| `tests/e2e/mocks/shell-memory.ts` | E2E 测试用的 MemoryShell 注入 |

---

### Task 1: Shell 接口定义

**Files:**
- Create: `src/shell/types.ts`

- [ ] **Step 1: 编写 Shell 接口**

```typescript
export type Unlisten = () => void

export interface Shell {
  /** 获取当前 Sidecar HTTP 端口，未就绪时返回 null */
  getSidecarPort(): Promise<number | null>

  /** 监听 sidecar-ready 事件 */
  onSidecarReady(handler: (payload: { port: number }) => void): Promise<Unlisten>

  /** 监听 sidecar-restarted 事件 */
  onSidecarRestarted(handler: (payload: { port: number }) => void): Promise<Unlisten>

  /** 请求重启 Sidecar */
  restartSidecar(): Promise<void>

  /** 打开文件对话框并导入到指定知识库路径 */
  importFiles(knowledgeBaseId: string, targetPath: string): Promise<void>
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shell/types.ts
git commit -m "feat(shell): define Shell interface with host environment abstraction"
```

---

### Task 2: TauriShell 适配器

**Files:**
- Create: `src/shell/tauri.ts`
- Modify: `src/shell/index.ts` (create if not exists)

- [ ] **Step 1: 实现 TauriShell**

```typescript
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { Shell, Unlisten } from './types'

export class TauriShell implements Shell {
  async getSidecarPort(): Promise<number | null> {
    try {
      return await invoke<number>('get_sidecar_port')
    } catch {
      return null
    }
  }

  async onSidecarReady(handler: (payload: { port: number }) => void): Promise<Unlisten> {
    return listen<{ port: number }>('sidecar-ready', (event) => {
      handler(event.payload)
    })
  }

  async onSidecarRestarted(handler: (payload: { port: number }) => void): Promise<Unlisten> {
    return listen<{ port: number }>('sidecar-restarted', (event) => {
      handler(event.payload)
    })
  }

  async restartSidecar(): Promise<void> {
    await invoke('restart_sidecar')
  }

  async importFiles(knowledgeBaseId: string, targetPath: string): Promise<void> {
    await invoke('import_files', { knowledgeBaseId, targetPath })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shell/tauri.ts
git commit -m "feat(shell): implement TauriShell adapter"
```

---

### Task 3: BrowserShell 适配器

**Files:**
- Create: `src/shell/browser.ts`
- Modify: `src/shell/index.ts`

- [ ] **Step 1: 实现 BrowserShell**

```typescript
import { sidecarFetch } from '@/utils/sidecarClient'
import type { Shell, Unlisten } from './types'

function getBrowserPort(): number {
  const stored = localStorage.getItem('sidecar-port')
  if (stored) {
    const parsed = parseInt(stored, 10)
    if (!isNaN(parsed) && parsed > 0) return parsed
  }
  const envPort = import.meta.env.VITE_SIDECAR_PORT
  if (envPort) {
    const parsed = parseInt(envPort, 10)
    if (!isNaN(parsed) && parsed > 0) return parsed
  }
  return 11451
}

export class BrowserShell implements Shell {
  private port = getBrowserPort()

  async getSidecarPort(): Promise<number | null> {
    return this.port
  }

  async onSidecarReady(handler: (payload: { port: number }) => void): Promise<Unlisten> {
    // 浏览器模式下端口已固定，立即触发
    setTimeout(() => handler({ port: this.port }), 0)
    return () => {}
  }

  async onSidecarRestarted(handler: (payload: { port: number }) => void): Promise<Unlisten> {
    // 浏览器模式下不监听重启事件
    return () => {}
  }

  async restartSidecar(): Promise<void> {
    // 浏览器模式下无操作
    console.warn('[BrowserShell] restartSidecar is a no-op in browser mode')
  }

  async importFiles(knowledgeBaseId: string, targetPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.multiple = true
      input.accept = '.txt,.md,.markdown'

      input.onchange = async () => {
        const files = input.files
        if (!files || files.length === 0) {
          resolve()
          return
        }

        const fileList: { name: string; content: string }[] = []
        for (const file of Array.from(files)) {
          const content = await file.text()
          fileList.push({ name: file.name, content })
        }

        try {
          const res = await sidecarFetch(`/knowledge-bases/${knowledgeBaseId}/files`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: targetPath, files: fileList }),
          })
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: '导入失败' }))
            reject(new Error(err.error || '导入失败'))
          } else {
            resolve()
          }
        } catch (e) {
          reject(e)
        }
      }

      input.click()
    })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shell/browser.ts
git commit -m "feat(shell): implement BrowserShell with HTML file input"
```

---

### Task 4: MemoryShell 适配器与测试

**Files:**
- Create: `src/shell/memory.ts`
- Create: `tests/unit/shell/memory.test.ts`

- [ ] **Step 1: 实现 MemoryShell**

```typescript
import type { Shell, Unlisten } from './types'

export interface MemoryShellOptions {
  initialPort?: number | null
  autoTriggerReady?: boolean
  autoTriggerRestarted?: boolean
}

export class MemoryShell implements Shell {
  private port: number | null
  private readyHandlers: Array<(payload: { port: number }) => void> = []
  private restartedHandlers: Array<(payload: { port: number }) => void> = []
  private restartCalled = false
  private importCalls: Array<{ knowledgeBaseId: string; targetPath: string }> = []

  constructor(options: MemoryShellOptions = {}) {
    this.port = options.initialPort ?? null
    if (options.autoTriggerReady && this.port !== null) {
      setTimeout(() => this.triggerReady(this.port!), 0)
    }
    if (options.autoTriggerRestarted && this.port !== null) {
      setTimeout(() => this.triggerRestarted(this.port!), 0)
    }
  }

  async getSidecarPort(): Promise<number | null> {
    return this.port
  }

  async onSidecarReady(handler: (payload: { port: number }) => void): Promise<Unlisten> {
    this.readyHandlers.push(handler)
    return () => {
      const idx = this.readyHandlers.indexOf(handler)
      if (idx !== -1) this.readyHandlers.splice(idx, 1)
    }
  }

  async onSidecarRestarted(handler: (payload: { port: number }) => void): Promise<Unlisten> {
    this.restartedHandlers.push(handler)
    return () => {
      const idx = this.restartedHandlers.indexOf(handler)
      if (idx !== -1) this.restartedHandlers.splice(idx, 1)
    }
  }

  async restartSidecar(): Promise<void> {
    this.restartCalled = true
  }

  async importFiles(knowledgeBaseId: string, targetPath: string): Promise<void> {
    this.importCalls.push({ knowledgeBaseId, targetPath })
  }

  // 测试控制方法
  triggerReady(port: number): void {
    this.port = port
    this.readyHandlers.forEach((h) => h({ port }))
  }

  triggerRestarted(port: number): void {
    this.port = port
    this.restartedHandlers.forEach((h) => h({ port }))
  }

  setPort(port: number | null): void {
    this.port = port
  }

  wasRestartCalled(): boolean {
    return this.restartCalled
  }

  getImportCalls(): Array<{ knowledgeBaseId: string; targetPath: string }> {
    return this.importCalls
  }
}
```

- [ ] **Step 2: 编写 MemoryShell 测试**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { MemoryShell } from '@/shell/memory'

describe('MemoryShell', () => {
  it('returns initial port', async () => {
    const shell = new MemoryShell({ initialPort: 11451 })
    expect(await shell.getSidecarPort()).toBe(11451)
  })

  it('returns null when no port set', async () => {
    const shell = new MemoryShell()
    expect(await shell.getSidecarPort()).toBeNull()
  })

  it('triggers ready event', async () => {
    const shell = new MemoryShell()
    const handler = vi.fn()
    await shell.onSidecarReady(handler)
    shell.triggerReady(11452)
    expect(handler).toHaveBeenCalledWith({ port: 11452 })
  })

  it('triggers restarted event', async () => {
    const shell = new MemoryShell()
    const handler = vi.fn()
    await shell.onSidecarRestarted(handler)
    shell.triggerRestarted(11453)
    expect(handler).toHaveBeenCalledWith({ port: 11453 })
  })

  it('unlisten removes handler', async () => {
    const shell = new MemoryShell()
    const handler = vi.fn()
    const unlisten = await shell.onSidecarReady(handler)
    unlisten()
    shell.triggerReady(11452)
    expect(handler).not.toHaveBeenCalled()
  })

  it('tracks restart calls', async () => {
    const shell = new MemoryShell()
    expect(shell.wasRestartCalled()).toBe(false)
    await shell.restartSidecar()
    expect(shell.wasRestartCalled()).toBe(true)
  })

  it('tracks import calls', async () => {
    const shell = new MemoryShell()
    await shell.importFiles('kb1', 'docs/')
    expect(shell.getImportCalls()).toEqual([{ knowledgeBaseId: 'kb1', targetPath: 'docs/' }])
  })

  it('auto triggers ready when configured', async () => {
    const handler = vi.fn()
    const shell = new MemoryShell({ initialPort: 11451, autoTriggerReady: true })
    await shell.onSidecarReady(handler)
    await vi.waitFor(() => expect(handler).toHaveBeenCalledWith({ port: 11451 }))
  })
})
```

- [ ] **Step 3: 运行测试**

```bash
pnpm test tests/unit/shell/memory.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/shell/memory.ts tests/unit/shell/memory.test.ts
git commit -m "feat(shell): implement MemoryShell with test controls and unit tests"
```

---

### Task 5: Shell 模块入口 — createShell / isTauri / useShell / setShell

**Files:**
- Create: `src/shell/index.ts`

- [ ] **Step 1: 实现入口模块**

```typescript
import { inject, provide } from 'vue'
import type { Shell } from './types'
import { TauriShell } from './tauri'
import { BrowserShell } from './browser'

const SHELL_KEY = Symbol('shell')

export function isTauri(): boolean {
  if (typeof window === 'undefined') return false
  if ('__TAURI_INTERNALS__' in window) return true
  if ('__TAURI__' in window) return true
  return false
}

export function createShell(): Shell {
  if (isTauri()) {
    return new TauriShell()
  }
  return new BrowserShell()
}

export function provideShell(shell: Shell) {
  provide(SHELL_KEY, shell)
}

export function useShell(): Shell {
  const shell = inject<Shell>(SHELL_KEY)
  if (!shell) {
    throw new Error('useShell() must be called inside a component with provideShell()')
  }
  return shell
}

// 测试注入支持
let overrideShell: Shell | null = null

export function setShell(shell: Shell | null) {
  overrideShell = shell
}

export function getShell(): Shell {
  if (overrideShell) return overrideShell
  return createShell()
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shell/index.ts
git commit -m "feat(shell): add createShell, isTauri, useShell, setShell utilities"
```

---

### Task 6: useSidecarStatus 重构

**Files:**
- Create: `src/composables/useSidecarStatus.ts`
- Delete: `src/composables/useSidecar.ts` (after migration)

- [ ] **Step 1: 实现 useSidecarStatus**

```typescript
import { ref } from 'vue'
import { getShell, setShell } from '@/shell'
import { setSidecarPort } from '@/utils/sidecarClient'
import type { Shell } from '@/shell/types'

export type SidecarStatus = 'loading' | 'ready' | 'error'

export const sidecarStatus = ref<SidecarStatus>('loading')
export const sidecarPort = ref<number | null>(null)
export const sidecarError = ref<string>('')

let initDone = false
let timeoutId: ReturnType<typeof setTimeout> | null = null
let readyUnlisten: (() => void) | null = null
let restartedUnlisten: (() => void) | null = null

function clearTimeoutIfAny(): void {
  if (timeoutId) {
    clearTimeout(timeoutId)
    timeoutId = null
  }
}

export async function initSidecarStatus(): Promise<void> {
  if (initDone) return
  initDone = true

  sidecarStatus.value = 'loading'
  sidecarError.value = ''

  const shell = getShell()

  try {
    const p = await shell.getSidecarPort()
    if (p !== null) {
      setSidecarPort(p)
      sidecarPort.value = p
      sidecarStatus.value = 'ready'
      return
    }
  } catch {
    // sidecar not ready yet, wait for events
  }

  let settleWait: (() => void) | null = null
  const waitPromise = new Promise<void>((resolve) => {
    settleWait = resolve
  })

  try {
    if (!readyUnlisten) {
      readyUnlisten = await shell.onSidecarReady((event) => {
        setSidecarPort(event.port)
        sidecarPort.value = event.port
        sidecarStatus.value = 'ready'
        clearTimeoutIfAny()
        settleWait?.()
        settleWait = null
      })
    }

    if (!restartedUnlisten) {
      restartedUnlisten = await shell.onSidecarRestarted((event) => {
        setSidecarPort(event.port)
        sidecarPort.value = event.port
        sidecarStatus.value = 'ready'
        clearTimeoutIfAny()
        settleWait?.()
        settleWait = null
      })
    }
  } catch (e) {
    console.error('[sidecar] Failed to listen for events:', e)
    sidecarStatus.value = 'error'
    sidecarError.value = '无法监听服务状态，请检查权限配置'
    settleWait?.()
    settleWait = null
    return
  }

  timeoutId = setTimeout(() => {
    if (sidecarStatus.value !== 'ready') {
      sidecarStatus.value = 'error'
      sidecarError.value = '服务启动超时，请检查日志或重启应用'
    }
    settleWait?.()
    settleWait = null
  }, 30000)

  await waitPromise
}

export async function retrySidecarStatus(): Promise<void> {
  clearTimeoutIfAny()
  sidecarStatus.value = 'loading'
  sidecarError.value = ''

  const shell = getShell()
  try {
    await shell.restartSidecar()
  } catch (e) {
    sidecarStatus.value = 'error'
    sidecarError.value = String(e)
  }
}

export function _resetSidecarStatusForTest(): void {
  initDone = false
  sidecarStatus.value = 'loading'
  sidecarPort.value = null
  sidecarError.value = ''
  clearTimeoutIfAny()
  readyUnlisten?.()
  restartedUnlisten?.()
  readyUnlisten = null
  restartedUnlisten = null
}
```

- [ ] **Step 2: Commit**

```bash
git add src/composables/useSidecarStatus.ts
git commit -m "feat(shell): add useSidecarStatus composable based on Shell interface"
```

---

### Task 7: 更新 App.vue 提供 Shell

**Files:**
- Modify: `src/App.vue`

- [ ] **Step 1: 修改 App.vue**

在 `<script setup>` 顶部添加：

```typescript
import { onMounted, defineAsyncComponent, provide } from 'vue'
import { createShell, provideShell } from '@/shell'
// ... other imports

// Provide shell instance for the entire app
provideShell(createShell())
```

将 `initSidecar` 改为 `initSidecarStatus`：

```typescript
import { initSidecarStatus, sidecarStatus } from './composables/useSidecarStatus'
// ...

onMounted(async () => {
  await initSidecarStatus()
  if (sidecarStatus.value === 'ready') {
    settingsStore.loadConfig()
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add src/App.vue
git commit -m "feat(shell): provide Shell instance in App.vue root"
```

---

### Task 8: 更新 SplashScreen.vue

**Files:**
- Modify: `src/components/SplashScreen.vue`

- [ ] **Step 1: 修改导入**

```typescript
import { sidecarStatus, sidecarError, retrySidecarStatus } from '@/composables/useSidecarStatus'

async function handleRetry() {
  await retrySidecarStatus()
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SplashScreen.vue
git commit -m "refactor(shell): SplashScreen use useSidecarStatus"
```

---

### Task 9: 更新 knowledgeBase store 的 importFiles

**Files:**
- Modify: `src/stores/knowledgeBase.ts`

- [ ] **Step 1: 修改 importFiles 方法**

添加导入：
```typescript
import { getShell } from '@/shell'
```

修改 `importFiles` 方法：
```typescript
async function importFiles() {
  if (!selectedKbId.value) return
  try {
    const shell = getShell()
    await shell.importFiles(selectedKbId.value, currentPath.value)
    // 刷新当前目录
    await loadFiles(currentPath.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}
```

同时移除顶部的 `invoke` 导入（如果 `knowledgeBase.ts` 中不再使用）。

- [ ] **Step 2: Commit**

```bash
git add src/stores/knowledgeBase.ts
git commit -m "refactor(shell): knowledgeBase store importFiles uses Shell"
```

---

### Task 10: useSidecarStatus 单元测试重构

**Files:**
- Create: `tests/unit/composables/useSidecarStatus.test.ts`
- Delete: `tests/unit/composables/useSidecar.test.ts`

- [ ] **Step 1: 编写新测试**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import {
  sidecarStatus,
  sidecarPort,
  sidecarError,
  initSidecarStatus,
  retrySidecarStatus,
  _resetSidecarStatusForTest,
} from '@/composables/useSidecarStatus'
import { setShell } from '@/shell'
import { MemoryShell } from '@/shell/memory'

describe('useSidecarStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    _resetSidecarStatusForTest()
    setShell(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    setShell(null)
  })

  it('should set ready when port is immediately available', async () => {
    const shell = new MemoryShell({ initialPort: 11451 })
    setShell(shell)
    await initSidecarStatus()
    expect(sidecarStatus.value).toBe('ready')
    expect(sidecarPort.value).toBe(11451)
  })

  it('should remain loading until event fires', async () => {
    const shell = new MemoryShell()
    setShell(shell)
    const done = initSidecarStatus()
    await flushPromises()
    expect(sidecarStatus.value).toBe('loading')
    shell.triggerReady(11499)
    await done
    expect(sidecarStatus.value).toBe('ready')
    expect(sidecarPort.value).toBe(11499)
  })

  it('should set error after 30s timeout', async () => {
    const shell = new MemoryShell()
    setShell(shell)
    const done = initSidecarStatus()
    await flushPromises()
    expect(sidecarStatus.value).toBe('loading')
    await vi.advanceTimersByTimeAsync(30000)
    await done
    expect(sidecarStatus.value).toBe('error')
    expect(sidecarError.value).toContain('超时')
  })

  it('should update port on sidecar-restarted event', async () => {
    const shell = new MemoryShell()
    setShell(shell)
    const done = initSidecarStatus()
    await flushPromises()
    shell.triggerReady(11451)
    await done
    expect(sidecarStatus.value).toBe('ready')
    expect(sidecarPort.value).toBe(11451)

    shell.triggerRestarted(11453)
    expect(sidecarStatus.value).toBe('ready')
    expect(sidecarPort.value).toBe(11453)
  })

  it('retrySidecarStatus should call restartSidecar and reset to loading', async () => {
    const shell = new MemoryShell({ initialPort: 11451 })
    setShell(shell)
    await initSidecarStatus()
    sidecarStatus.value = 'error'

    await retrySidecarStatus()
    expect(shell.wasRestartCalled()).toBe(true)
    expect(sidecarStatus.value).toBe('loading')
  })

  it('should be idempotent when initSidecarStatus is called multiple times', async () => {
    const shell = new MemoryShell({ initialPort: 11451 })
    setShell(shell)
    await initSidecarStatus()
    expect(sidecarStatus.value).toBe('ready')
    expect(sidecarPort.value).toBe(11451)

    await initSidecarStatus()
    expect(sidecarPort.value).toBe(11451)
  })
})
```

- [ ] **Step 2: 运行测试**

```bash
pnpm test tests/unit/composables/useSidecarStatus.test.ts
```

Expected: PASS

- [ ] **Step 3: 删除旧测试文件**

```bash
git rm tests/unit/composables/useSidecar.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add tests/unit/composables/useSidecarStatus.test.ts
git commit -m "test(shell): refactor useSidecar tests to use MemoryShell"
```

---

### Task 11: E2E mock 迁移 — tauri-ipc.ts 改为 MemoryShell 注入

**Files:**
- Create: `tests/e2e/mocks/shell-memory.ts`
- Delete: `tests/e2e/mocks/tauri-ipc.ts`

- [ ] **Step 1: 创建新的 E2E Shell mock**

```typescript
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
```

- [ ] **Step 2: 更新所有 E2E spec 文件**

修改 `tests/e2e/specs/*.spec.ts`，将 `injectMockTauri` 替换为 `injectMockShell`。

以 `kb-context-menu.spec.ts` 为例：

```typescript
// 旧
import { injectMockTauri } from '../mocks/tauri-ipc'
// 新
import { injectMockShell } from '../mocks/shell-memory'

// beforeEach 中
await injectMockTauri(page)
// 改为
await injectMockShell(page)
```

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/mocks/shell-memory.ts tests/e2e/specs/*.spec.ts
git rm tests/e2e/mocks/tauri-ipc.ts
git commit -m "test(e2e): replace tauri-ipc mock with Shell MemoryShell injection"
```

---

### Task 12: 浏览器模式验证

**Files:**
- 无文件修改，纯验证

- [ ] **Step 1: 启动 Vite dev server（不启动 Tauri）**

```bash
pnpm dev
```

- [ ] **Step 2: 在浏览器中访问 `http://localhost:1420`**

验证：
- [ ] 页面加载，显示 SplashScreen
- [ ] SplashScreen 自动变为 ready（BrowserShell 立即触发 ready 事件）
- [ ] 主 UI 渲染
- [ ] 知识库列表可加载（Sidecar 需在 localhost:11451 运行）
- [ ] 文件导入按钮点击后弹出系统文件选择对话框

- [ ] **Step 3: 运行全部测试**

```bash
pnpm test
pnpm test:e2e
```

Expected: 全部通过

- [ ] **Step 4: Commit（如有修复）**

---

### Task 13: 清理旧 useSidecar.ts

**Files:**
- Delete: `src/composables/useSidecar.ts`

- [ ] **Step 1: 确认无其他文件引用 `useSidecar.ts`**

```bash
grep -r "from '@/composables/useSidecar'" src/ tests/
```

Expected: 无结果（App.vue 和 SplashScreen.vue 已改为 useSidecarStatus）

- [ ] **Step 2: 删除文件**

```bash
git rm src/composables/useSidecar.ts
```

- [ ] **Step 3: Commit**

```bash
git commit -m "chore(shell): remove deprecated useSidecar composable"
```

---

## Self-Review

### 1. Spec coverage

| #10 验收标准 | 对应 Task |
|-------------|----------|
| Shell 接口定义 | Task 1 |
| TauriShell 适配器 | Task 2 |
| BrowserShell 适配器 | Task 3 |
| MemoryShell 适配器 | Task 4 |
| 运行时环境检测 | Task 5 (`isTauri`) |
| 替换 useSidecar | Task 6, 10, 13 |
| 替换 knowledgeBase importFiles | Task 9 |
| 单元测试更新 | Task 4, 10 |
| E2E 测试更新 | Task 11 |
| 浏览器模式验证 | Task 12 |

**无遗漏。**

### 2. Placeholder scan

- 无 "TBD"、"TODO"、"implement later"
- 无 "Add appropriate error handling" 等模糊描述
- 每个步骤包含完整代码

### 3. Type consistency

- `Unlisten` 类型在 `types.ts` 定义，所有适配器一致使用
- `Shell` 接口方法签名在所有适配器中一致
- `useSidecarStatus` 导出与旧 `useSidecar` 相同的状态变量名（`sidecarStatus`、`sidecarPort`、`sidecarError`）

---

## 执行交接

**Plan complete and saved to `docs/superpowers/plans/2026-05-14-shell-abstraction.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
