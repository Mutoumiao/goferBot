# ADR-0005: 自动化端到端测试架构方案

**状态**: 提案  
**日期**: 2026-05-08  
**决策者**: 开发团队  

---

## 1. 背景与问题

当前项目拥有 34 个测试文件、236 条用例，全部在单元/组件层通过 Vitest 运行。但测试用例文档中标记为 **"手动验证"** 或 **"Tauri 集成测试"** 的场景共 40 余项，分散在 #01、#03、#03b、#04、#05、#06 中。这些场景的共同特征是：

- 跨越前端 Vue ↔ Tauri Rust IPC ↔ Node.js Sidecar ↔ SQLite 多个进程边界
- 涉及文件系统、网络请求、外部 API（Embedding/LLM）
- UI 交互链长（如：右键菜单 → 移动弹窗 → 面包屑导航 → 确认 → 索引同步）

纯单元测试无法验证这些跨进程、跨运行时的真实行为。

---

## 2. 端到端测试缺口分析

### 2.1 缺口清单（按 Issue 聚合）

| Issue | 场景数 | 典型场景 | 核心依赖 |
|-------|--------|----------|----------|
| #01 | 6 | Sidecar 崩溃自动重启、端口文件 discover、IPC 调用 | Rust 进程管理 + 文件系统 |
| #03 | 6 | 文件导入全链路：前端 invoke → Rust 对话框 → Sidecar HTTP → 物理写入 | Tauri IPC + Rust fs + Sidecar |
| #03b | 12 | 右键菜单 → 置顶/修改资料/移入回收站、移动/复制弹窗跨库操作 | 前端 DOM + Sidecar API + 索引同步 |
| #04 | 5 | 文件导入 → 自动索引 → `@提及` → 检索生效 → LLM 引用 | Sidecar 队列 + Embedding API + SQLite-vec |
| #05 | 5 | 设置页保存 → config.json 加密存储 → 新建会话使用默认配置 | 前端表单 + fs 加密 + 会话创建 |
| #06 | 7 | 新建对话 → 发送消息 → 历史页可见 → 恢复 → 标签标题同步 | 前端路由 + Sidecar 会话 API + Store 联动 |

### 2.2 为什么单元测试无法覆盖

- **Tauri IPC 不可 mock 于真实进程**：`invoke('import_files')` 最终调用 Rust 的 `tauri::generate_handler`，其中打开系统文件对话框的行为在 jsdom/Vitest 中无法模拟。
- **SQLite-vec 扩展依赖原生动态库**：`.dll`/`.dylib`/`.so` 的加载在内存数据库或 mock 环境中与生产环境行为不同。
- **多进程状态同步**：Sidecar 崩溃后 Rust monitor_loop 重新 spawn、端口递增、前端收到 `sidecar-restarted` 事件，涉及三个进程的状态机联动。
- **文件系统边效应**：跨库移动文件后，`document_chunks` / `fts_document_chunks` / `vec_document_chunks` 三表一致性必须基于真实物理目录操作验证。

---

## 3. 架构方案：三阶 E2E 模型

不采用单一"启动完整应用点击 UI"的黑盒方案（太慢、太脆），而是按**进程边界**分层，每层用最适合的工具，逐阶递进。

```
┌─────────────────────────────────────────────────────────────────┐
│  阶3 — 全链路验收（Full-Stack Acceptance）                       │
│  启动完整 Tauri 应用 + Playwright WebView2                       │
│  覆盖：创建知识库 → 导入文件 → @提及 → 检索 → LLM 回答            │
│  频率：每次 Release 前 / 关键 PR                                 │
├─────────────────────────────────────────────────────────────────┤
│  阶2 — Sidecar 集成（Sidecar Integration）                       │
│  启动真实 sidecar 进程 + 临时数据目录 + mock 外部 API             │
│  覆盖：API 路由 + SQLite + 索引队列 + RAG 混合搜索                │
│  频率：每次 commit / CI                                         │
├─────────────────────────────────────────────────────────────────┤
│  阶1 — 前端 E2E（Frontend E2E）                                  │
│  Playwright + vite dev（无 Tauri）+ mock IPC                     │
│  覆盖：页面路由 + 组件交互 + 表单验证 + Store 联动                │
│  频率：每次 commit / CI                                         │
└─────────────────────────────────────────────────────────────────┘
```

### 3.1 阶1：前端 E2E（Playwright + mock IPC）

**目标**：验证前端在用户操作下的页面流转、组件交互、状态管理。

**为什么不启动 Tauri**：
- Tauri 启动耗时 5~15s，打包更久，不适合高频 CI
- 前端 E2E 的核心是验证 Vue 组件树和 Pinia Store 的联动，而非 Rust IPC

**技术栈**：
- **Playwright**（已内置 Chromium/WebKit/Firefox 支持，对 Vue 友好）
- **Vite dev server** 运行前端（`pnpm dev`，不启动 Tauri）
- **@vitest/coverage-v8** 做前端覆盖率

**mock 策略**：
```typescript
// tests/e2e/mocks/tauri.ts
// 在 Playwright 的 page.evaluate 中注入
window.__TAURI__ = {
  invoke: (cmd: string, args: any) => {
    if (cmd === 'import_files') {
      // 不弹出系统对话框，直接返回预设文件路径列表
      return Promise.resolve(['/mock/docs/hello.md'])
    }
    if (cmd === 'get_sidecar_port') {
      return Promise.resolve(11451)
    }
    // ... 其他命令按场景返回
  },
  event: {
    listen: (event: string, handler: Function) => {
      if (event === 'sidecar-ready') {
        setTimeout(() => handler({ port: 11451 }), 100)
      }
      return Promise.resolve(() => {}) // unlisten
    }
  }
}
```

**HTTP 请求拦截**：Playwright 的 `page.route` 拦截对 `http://127.0.0.1:*` 的请求，返回 mock JSON：
```typescript
await page.route('http://127.0.0.1:*/knowledge-bases', route => {
  route.fulfill({ json: [{ id: 'kb1', name: 'Test KB' }] })
})
```

**覆盖场景**（来自测试用例文档）：
- #03b E2E-01~12：右键菜单交互、置顶排序、移动/复制弹窗、回收站恢复
- #05 TC-05-017~23：设置页导航、tab 单例、表单保存
- #06 TC-06-019~24：历史页打开、Loading、错误重试
- #06 TC-06-025~31：历史列表渲染、悬浮操作按钮
- #06 TC-06-038~50：删除确认、重命名编辑、标签同步

**目录结构**：
```
tests/e2e/
├── fixtures/              # mock 数据
│   ├── knowledge-bases.ts
│   ├── sessions.ts
│   └── settings.ts
├── mocks/
│   └── tauri-ipc.ts       # 全局 IPC mock
├── pages/                 # Page Object Model
│   ├── ChatPage.ts
│   ├── KnowledgeBasePage.ts
│   ├── HistoryPage.ts
│   └── SettingsPage.ts
├── specs/
│   ├── kb-context-menu.spec.ts
│   ├── settings.spec.ts
│   ├── chat-history.spec.ts
│   └── rag-mention.spec.ts
└── playwright.config.ts
```

**CI 集成**：
```yaml
# .github/workflows/e2e.yml（示意）
- run: pnpm install
- run: pnpm exec playwright install chromium
- run: pnpm exec playwright test tests/e2e/specs/
```

### 3.2 阶2：Sidecar 集成测试（真实进程 + 临时目录 + mock 外部 API）

**目标**：验证 Sidecar 的 API 路由、数据库操作、索引队列、RAG 检索，在真实 Node.js 进程中运行。

**为什么不直接用 Hono app 实例**：
- `sqlite-vec` 扩展需要真实的 `.dll`/`.dylib`/`.so` 加载，在纯内存环境中行为不同
- 索引队列使用全局变量和 `setTimeout`，在测试进程的模块隔离中才能验证真实并发行为
- 文件导入 API 需要真实的 `docs/` 目录写入

**技术栈**：
- **Vitest**（复用现有测试框架）
- **真实 sidecar 进程**：通过 `child_process.spawn('node', ['server/dist/index.js'], { env: { KB_DATA_DIR: tmpDir } })` 启动
- **临时数据目录**：`os.tmpdir()` + `fs.mkdtempSync`，每个测试用例独立
- **mock 外部 API**：用 **MSW（Mock Service Worker）** 或简单的 `http.createServer` 启动本地 mock server，拦截 Embedding 和 LLM 请求

**Sidecar 启动模式**：
```typescript
// tests/integration/sidecar/setup.ts
import { spawn } from 'child_process'
import { tmpdir } from 'os'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'

let sidecarProcess: ReturnType<typeof spawn>
let dataDir: string

export async function startSidecar() {
  dataDir = mkdtempSync(join(tmpdir(), 'kb-e2e-'))
  sidecarProcess = spawn('node', ['server/dist/index.js'], {
    env: {
      ...process.env,
      KB_DATA_DIR: dataDir,      // sidecar 读取此环境变量作为数据目录
      KB_PORT: '0',              // 让 sidecar 自动选择端口
    },
    stdio: 'pipe',
  })

  // 等待 .sidecar-port 文件出现（复用 Rust 端的发现逻辑）
  const port = await waitForPortFile(dataDir)
  return { port, dataDir }
}

export async function stopSidecar() {
  sidecarProcess.kill()
  rmSync(dataDir, { recursive: true, force: true })
}
```

**Mock Embedding API**：
```typescript
// tests/integration/mocks/embedding-server.ts
import { createServer } from 'http'

export function startMockEmbeddingServer(port: number) {
  return createServer((req, res) => {
    if (req.url === '/v1/embeddings') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        data: [
          { embedding: new Array(1536).fill(0.1), index: 0 },
          { embedding: new Array(1536).fill(0.2), index: 1 },
        ]
      }))
    }
  }).listen(port)
}
```

**测试用例示例**：
```typescript
// tests/integration/sidecar/rag-flow.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { startSidecar, stopSidecar } from '../setup'
import { startMockEmbeddingServer } from '../mocks/embedding-server'

describe('E2E RAG 全链路', () => {
  let port: number, dataDir: string
  let mockEmbedding: ReturnType<typeof startMockEmbeddingServer>

  beforeAll(async () => {
    mockEmbedding = startMockEmbeddingServer(18080)
    const sidecar = await startSidecar()
    port = sidecar.port
    dataDir = sidecar.dataDir

    // 写入 Embedding 配置，指向 mock server
    await fetch(`http://127.0.0.1:${port}/settings`, {
      method: 'POST',
      body: JSON.stringify({
        embeddingProvider: {
          provider: 'openai',
          model: 'text-embedding-3-small',
          baseUrl: 'http://127.0.0.1:18080/v1',
          apiKey: 'mock-key',
        }
      })
    })
  })

  afterAll(async () => {
    await stopSidecar()
    mockEmbedding.close()
  })

  it('TC-04-066: 文件导入 → 自动索引 → 可检索', async () => {
    // 1. 创建知识库
    const kb = await fetch(`http://127.0.0.1:${port}/knowledge-bases`, {
      method: 'POST', body: JSON.stringify({ name: 'Test' })
    }).then(r => r.json())

    // 2. 导入文件
    await fetch(`http://127.0.0.1:${port}/knowledge-bases/${kb.id}/files`, {
      method: 'POST',
      body: JSON.stringify({ files: [{ name: 'hello.md', content: '# Hello\n\nRAG works!' }] })
    })

    // 3. 等待索引完成（轮询 index-status）
    await waitForIndexed(port, kb.id)

    // 4. 发送 chat 请求，验证检索到内容
    const response = await fetch(`http://127.0.0.1:${port}/chat`, {
      method: 'POST',
      body: JSON.stringify({
        message: 'What is RAG?',
        sessionId: 'sess-1',
        knowledgeBaseIds: [kb.id],
      })
    })
    const sseText = await response.text()
    expect(sseText).toContain('RAG works')
  })
})
```

**覆盖场景**：
- #01 TC-01-007~018：端口发现、健康检查、自动重启（通过 kill sidecar 进程验证）
- #03 TC-03-061~066：文件导入全链路（跳过 Rust 对话框，直接 HTTP POST 文件内容，但验证 Sidecar 的物理写入和数据库记录）
- #04 TC-04-014~024：索引队列、重建索引、分块参数
- #04 TC-04-066~070：端到端 RAG 链路（真实 sqlite-vec + mock Embedding）
- #04b TC-04b-001~020：移动/复制/重命名后索引同步（真实文件系统 + 真实数据库）
- #05 TC-05-001~009：配置读写（真实 config.json + 加密验证）
- #05 TC-05-059~063：LLM 调用读取会话级配置
- #06 TC-06-001~018：会话列表、重命名、删除级联

**CI 集成**：
```yaml
- run: pnpm --dir server build
- run: pnpm vitest run tests/integration/
```

### 3.3 阶3：全链路验收（Tauri 应用 + Playwright WebView2）

**目标**：验证最核心、最不可 mock 的用户旅程，确保 Tauri 打包后的应用行为正确。

**为什么需要这一阶**：
- Tauri 的 `tauri.conf.json`、capabilities、permissions 配置错误只能在打包后暴露
- WebView2 与 Chromium 的行为差异（如 CSS 渲染、JavaScript 执行）
- Rust 与 Sidecar 的进程协调在实际打包产物中才可能出现问题

**技术栈**：
- **Playwright**（支持 WebView2 连接）
- **Tauri 打包产物**：`pnpm tauri build` 后的 `.exe`（Windows）
- **WebView2 连接**：Playwright 的 `chromium.connectOverCDP` 连接到 Tauri 的 DevTools 端口

**启动方式**：
```typescript
// tests/e2e-full/setup.ts
import { chromium } from '@playwright/test'
import { spawn } from 'child_process'

export async function launchTauriApp() {
  const appPath = 'src-tauri/target/release/knowledge-base.exe'
  const app = spawn(appPath, [], {
    env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=9222' }
  })

  // 等待 WebView2 启动
  await waitForPort(9222, 30000)

  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222')
  const context = browser.contexts()[0]
  const page = context.pages()[0] || await context.newPage()

  return { app, browser, page }
}
```

**覆盖场景**（仅最关键 3~5 条）：
- #03 TC-03-061：真实的 `invoke('import_files')` 弹出系统对话框（可用 Playwright 的 `page.on('filechooser')` 或直接注入文件路径到 Rust 端）
- #04 TC-04-066：完整的 RAG 链路，从前端 `@提及` 到 LLM 回答渲染
- #05 TC-05-064：设置页保存 → 新建会话使用默认配置
- #06 TC-06-062：新建对话 → 发送消息 → 历史页可见

**执行频率**：
- 每次 Release 前手动/自动执行
- 关键架构变更（如 Tauri 升级、Sidecar 通信协议变更）后执行
- 不纳入日常 CI（构建耗时 3~10 分钟）

---

## 4. 技术选型对比

| 维度 | 阶1 Playwright | 阶2 Vitest + Sidecar | 阶3 Playwright + WebView2 |
|------|----------------|----------------------|---------------------------|
| **启动速度** | 3~5s | 2~3s（sidecar spawn） | 30s~2min（含打包） |
| **进程依赖** | 仅前端 dev server | Node.js Sidecar + mock API | 完整 Tauri 应用 |
| **外部 API** | mock HTTP | mock HTTP（MSW/本地 server） | 真实或 mock |
| **文件系统** | mock | 真实临时目录 | 真实用户目录（可改） |
| **SQLite-vec** | 不涉及 | 真实加载 | 真实加载 |
| **Tauri IPC** | mock | 不涉及（纯 HTTP） | 真实 |
| **稳定性** | 高 | 高 | 中（打包/环境敏感） |
| **CI 适配** | 完美 | 完美 | 需自托管 runner |
| **维护成本** | 低 | 中 | 高 |

**排除的方案**：
- **tauri-driver / WebDriver**：配置复杂，Windows 下 WebView2 的 WebDriver 支持不完善，调试困难
- **Spectron**：已废弃，Tauri 无官方等价物
- **Cypress**：对跨域和文件上传支持不如 Playwright，且不支持 WebView2

---

## 5. 实施路线图

### 阶段一：基础设施（1~2 天）

1. **安装 Playwright**：`pnpm create playwright tests/e2e`
2. **编写 IPC mock 工具**：`tests/e2e/mocks/tauri-ipc.ts`
3. **编写 Sidecar 集成测试 setup**：`tests/integration/setup.ts`
4. **编写 Mock Embedding Server**：`tests/integration/mocks/embedding-server.ts`
5. **配置 CI**：GitHub Actions 增加 `e2e` job

### 阶段二：阶1 前端 E2E（3~4 天）

按优先级实现 specs：
1. `kb-context-menu.spec.ts`（#03b 的 12 个手动场景）
2. `settings.spec.ts`（#05 的配置页交互）
3. `chat-history.spec.ts`（#06 的历史页交互）

### 阶段三：阶2 Sidecar 集成（4~5 天）

按优先级实现 suites：
1. `sidecar/index-sync.test.ts`（#04b 的 20 个场景，涉及真实文件系统，价值最高）
2. `sidecar/rag-flow.test.ts`（#04 的 5 个端到端场景）
3. `sidecar/sessions.test.ts`（#06 的会话 API）
4. `sidecar/settings-api.test.ts`（#05 的配置读写 + 加密）

### 阶段四：阶3 全链路验收（2~3 天，可选）

1. 配置 Tauri 打包后的 WebView2 调试端口
2. 编写 `tests/e2e-full/smoke.spec.ts`（3 条核心用户旅程）
3. 配置 Release 前自动执行

---

## 6. 目录结构（完整）

```
tests/
├── unit/                          # 现有 34 个文件，不变
│   ├── components/
│   ├── server/
│   ├── stores/
│   └── utils/
├── e2e/                           # 阶1：前端 E2E（Playwright）
│   ├── fixtures/
│   ├── mocks/
│   ├── pages/
│   ├── specs/
│   └── playwright.config.ts
├── integration/                   # 阶2：Sidecar 集成（Vitest）
│   ├── mocks/
│   │   └── embedding-server.ts
│   ├── sidecar/
│   │   ├── index-sync.test.ts
│   │   ├── rag-flow.test.ts
│   │   ├── sessions.test.ts
│   │   └── settings-api.test.ts
│   └── setup.ts
└── e2e-full/                      # 阶3：全链路验收（Playwright + WebView2）
    ├── specs/
    │   └── smoke.spec.ts
    └── setup.ts
```

**Vitest 配置隔离**：
```typescript
// vitest.config.ts 不变，继续运行 tests/unit/**
// vitest.integration.config.ts —— 阶2 专用
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    globalSetup: './tests/integration/setup.ts',
    testTimeout: 30000,
  },
})
```

---

## 7. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Sidecar 集成测试在 Windows 上端口冲突 | 高 | 使用 `KB_PORT=0` 让 OS 自动分配端口，从 `.sidecar-port` 读取 |
| SQLite 文件锁导致测试串行化 | 中 | 每个测试用例独立的临时目录； Vitest `pool: 'forks'` 进程隔离 |
| Mock Embedding Server 响应慢拖慢 CI | 中 | 本地起 server，响应延迟 < 10ms； 用例中批量请求减少往返 |
| Playwright WebView2 连接不稳定 | 中 | 阶3 不纳入日常 CI，仅 Release 前执行； 增加重试机制 |
| Tauri 打包耗时过长 | 低 | 阶3 使用 debug 模式构建（`tauri build --debug`），跳过代码签名 |

---

## 8. 结论

采用**三阶 E2E 模型**：

- **阶1 Playwright 前端 E2E** 解决 UI 交互和页面流转验证，用 mock IPC 绕过 Tauri 启动开销
- **阶2 Vitest + 真实 Sidecar** 解决跨进程 API 和数据库一致性验证，用临时目录 + mock 外部 API 控制环境
- **阶3 Playwright + WebView2** 仅在关键里程碑验证完整打包产物的行为

此方案不引入复杂的 WebDriver 配置，复用团队已有的 Vitest 和 Playwright 知识，按进程边界分层使失败定位更快、维护成本更低。
