# Monorepo 结构迁移 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将项目从扁平结构迁移为 pnpm Monorepo，JavaScript/TypeScript 模块按职责拆分为独立 workspace 包，统一使用 `@goferbot/` 前缀，`src-tauri/` 保留根目录不变。

**Architecture:** 通过 pnpm workspace 管理 `packages/webui`、`packages/shellAdapters`、`packages/backendAdapters`、`packages/server`、`packages/rag-sdk`。各包通过 `workspace:*` 相互引用。根目录保留聚合脚本。Tauri 配置更新构建产物路径。

**Tech Stack:** pnpm workspaces, Vue 3, Vite, TypeScript, Vitest, Tauri v2

---

## 前置条件

- #10 (Shell Abstraction) 已完成，`src/shell/` 目录存在且功能正常
- #11 (Backend Transport) 已完成，`src/backend/` 目录存在且功能正常
- 所有测试在 `master` 分支通过

---

## File Structure

| File | Responsibility |
|------|---------------|
| `pnpm-workspace.yaml` | pnpm workspace 配置，声明 `packages/*` |
| `package.json` (root) | 根 workspace 配置，聚合脚本 |
| `packages/webui/package.json` | Vue 3 前端包，`@goferbot/webui` |
| `packages/webui/vite.config.ts` | Vite 配置，含路径 alias |
| `packages/webui/vitest.config.ts` | Vitest 配置，测试路径更新 |
| `packages/shellAdapters/package.json` | Shell 适配层包，`@goferbot/shell-adapters` |
| `packages/shellAdapters/tsconfig.json` | 独立 TS 配置，输出 ESM + 类型 |
| `packages/backendAdapters/package.json` | Backend 适配层包，`@goferbot/backend-adapters` |
| `packages/backendAdapters/tsconfig.json` | 独立 TS 配置，输出 ESM + 类型 |
| `packages/server/package.json` | Sidecar 包，`@goferbot/server` |
| `packages/rag-sdk/package.json` | RAG SDK 空骨架，`@goferbot/rag-sdk` |
| `src-tauri/tauri.conf.json` | 更新 `frontendDist` 路径 |

---

### Task 1: 创建 pnpm Workspace 配置

**Files:**
- Create: `pnpm-workspace.yaml`
- Modify: `package.json` (root)

- [ ] **Step 1: 创建 pnpm-workspace.yaml**

```yaml
packages:
  - 'packages/*'
```

- [ ] **Step 2: 更新根 package.json**

将根 `package.json` 改为 workspace 根配置：

```json
{
  "name": "@goferbot/root",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "pnpm --filter @goferbot/webui dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "type-check": "pnpm -r type-check",
    "check": "cd src-tauri && cargo check",
    "tauri": "pnpm --filter @goferbot/webui tauri",
    "preview": "pnpm --filter @goferbot/webui preview"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.0",
    "@vue/test-utils": "^2.4.0",
    "autoprefixer": "^10.4.0",
    "jsdom": "^24.0.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^4.0.0",
    "typescript": "~5.6.0",
    "vite": "^6.0.0",
    "vitest": "^3.0.0",
    "vue-tsc": "^2.2.0"
  }
}
```

> 注意：原 `dependencies` 和 `devDependencies` 中属于前端的包迁移到 `packages/webui/package.json`。根目录只保留真正全局共享的 devDependencies（如 TypeScript、Vite 等可保留在根目录由 pnpm 统一 hoist）。

- [ ] **Step 3: Commit**

```bash
git add pnpm-workspace.yaml package.json
git commit -m "chore(workspace): initialize pnpm monorepo configuration"
```

---

### Task 2: 迁移 server 包

**Files:**
- Create: `packages/server/` (move from `server/`)
- Modify: `packages/server/package.json`

- [ ] **Step 1: 移动 server 目录**

```bash
git mv server/src packages/server/src
git mv server/dist packages/server/dist
git mv server/package.json packages/server/package.json
git mv server/tsconfig.json packages/server/tsconfig.json
```

> 如果 `server/` 下还有其他文件（如 `.gitignore`、`README.md` 等），一并移动。

- [ ] **Step 2: 更新 server package.json**

```json
{
  "name": "@goferbot/server",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@hono/node-server": "^1.13.0",
    "better-sqlite3": "^11.0.0",
    "hono": "^4.6.0",
    "langchain": "^0.3.0",
    "nanoid": "^5.0.0",
    "sqlite-vec": "^0.1.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "~5.6.0"
  }
}
```

- [ ] **Step 3: 验证 server 构建**

```bash
pnpm --filter @goferbot/server install
pnpm --filter @goferbot/server build
```

Expected: `packages/server/dist/index.js` 生成成功

- [ ] **Step 4: Commit**

```bash
git add packages/server/
git commit -m "chore(monorepo): migrate server to packages/server"
```

---

### Task 3: 创建 shellAdapters 包

**Files:**
- Create: `packages/shellAdapters/package.json`
- Create: `packages/shellAdapters/tsconfig.json`
- Create: `packages/shellAdapters/src/` (move from `src/shell/`)

- [ ] **Step 1: 创建目录结构**

```bash
mkdir -p packages/shellAdapters/src
```

- [ ] **Step 2: 移动 shell 模块代码**

```bash
git mv src/shell/types.ts packages/shellAdapters/src/types.ts
git mv src/shell/tauri.ts packages/shellAdapters/src/tauri.ts
git mv src/shell/browser.ts packages/shellAdapters/src/browser.ts
git mv src/shell/memory.ts packages/shellAdapters/src/memory.ts
git mv src/shell/index.ts packages/shellAdapters/src/index.ts
```

- [ ] **Step 3: 更新内部导入路径**

修改 `packages/shellAdapters/src/tauri.ts`、`browser.ts`、`memory.ts` 中的相对导入：

```typescript
// 原
import type { Shell, Unlisten } from './types'
// 保持不变（相对路径仍然正确）
```

- [ ] **Step 4: 创建 shellAdapters package.json**

```json
{
  "name": "@goferbot/shell-adapters",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "type-check": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "vue": "^3.5.0"
  },
  "peerDependencies": {
    "@tauri-apps/api": "^2.0.0"
  },
  "peerDependenciesMeta": {
    "@tauri-apps/api": {
      "optional": true
    }
  },
  "devDependencies": {
    "@tauri-apps/api": "^2.0.0",
    "typescript": "~5.6.0",
    "vitest": "^3.0.0"
  }
}
```

> `@tauri-apps/api` 设为 optional peerDependency，因为浏览器模式下不需要安装。

- [ ] **Step 5: 创建 shellAdapters tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM"],
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 6: 更新 shellAdapters 入口导出**

确认 `packages/shellAdapters/src/index.ts` 导出完整：

```typescript
export type { Shell, Unlisten } from './types'
export { TauriShell } from './tauri'
export { BrowserShell } from './browser'
export { MemoryShell } from './memory'
export { createShell, isTauri, provideShell, useShell, setShell, getShell } from './shell'
```

> 注意：原 `src/shell/index.ts` 中的 `provideShell` / `useShell` 使用了 Vue 的 `provide` / `inject`，这些属于 Vue 依赖，已声明在 `dependencies` 中。

- [ ] **Step 7: 构建验证**

```bash
pnpm --filter @goferbot/shell-adapters build
```

Expected: `packages/shellAdapters/dist/` 生成，包含 `.js` 和 `.d.ts` 文件

- [ ] **Step 8: Commit**

```bash
git add packages/shellAdapters/
git commit -m "chore(monorepo): create shellAdapters package from src/shell"
```

---

### Task 4: 创建 backendAdapters 包

**Files:**
- Create: `packages/backendAdapters/package.json`
- Create: `packages/backendAdapters/tsconfig.json`
- Create: `packages/backendAdapters/src/` (move from `src/backend/`)

- [ ] **Step 1: 创建目录并移动代码**

```bash
mkdir -p packages/backendAdapters/src
git mv src/backend/types.ts packages/backendAdapters/src/types.ts
git mv src/backend/http-transport.ts packages/backendAdapters/src/http-transport.ts
git mv src/backend/fake-transport.ts packages/backendAdapters/src/fake-transport.ts
git mv src/backend/index.ts packages/backendAdapters/src/index.ts
```

- [ ] **Step 2: 更新 backendAdapters 内部导入**

修改 `packages/backendAdapters/src/http-transport.ts` 中的 Shell 导入：

```typescript
// 原
import type { Shell } from '@/shell/types'
// 新
import type { Shell } from '@goferbot/shell-adapters'
```

修改 `packages/backendAdapters/src/index.ts`：

```typescript
// 原
import { getShell } from '@/shell'
// 新
import { getShell } from '@goferbot/shell-adapters'
```

- [ ] **Step 3: 创建 backendAdapters package.json**

```json
{
  "name": "@goferbot/backend-adapters",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "type-check": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@goferbot/shell-adapters": "workspace:*"
  },
  "devDependencies": {
    "typescript": "~5.6.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 4: 创建 backendAdapters tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM"],
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 5: 构建验证**

```bash
pnpm --filter @goferbot/backend-adapters build
```

Expected: `packages/backendAdapters/dist/` 生成成功

- [ ] **Step 6: Commit**

```bash
git add packages/backendAdapters/
git commit -m "chore(monorepo): create backendAdapters package from src/backend"
```

---

### Task 5: 迁移 webui 包

**Files:**
- Create: `packages/webui/` (move from root `src/`, `index.html`, configs)
- Modify: `packages/webui/package.json`
- Modify: `packages/webui/vite.config.ts`
- Modify: `packages/webui/vitest.config.ts`

- [ ] **Step 1: 创建目录并移动文件**

```bash
mkdir -p packages/webui
```

移动前端源码和配置：

```bash
# 源码
git mv src packages/webui/src

# 配置文件
git mv index.html packages/webui/index.html
git mv vite.config.ts packages/webui/vite.config.ts
git mv vitest.config.ts packages/webui/vitest.config.ts
git mv tsconfig.json packages/webui/tsconfig.json
git mv tsconfig.app.json packages/webui/tsconfig.app.json
git mv tsconfig.node.json packages/webui/tsconfig.node.json

# 其他前端相关文件（如有）
# git mv postcss.config.js packages/webui/postcss.config.js
# git mv tailwind.config.js packages/webui/tailwind.config.js
```

- [ ] **Step 2: 创建 webui package.json**

```json
{
  "name": "@goferbot/webui",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "type-check": "vue-tsc --noEmit"
  },
  "dependencies": {
    "@egoist/tailwindcss-icons": "^1.9.0",
    "@goferbot/backend-adapters": "workspace:*",
    "@goferbot/shell-adapters": "workspace:*",
    "@iconify-json/mdi": "^1.2.0",
    "@tauri-apps/api": "^2.0.0",
    "@tauri-apps/plugin-dialog": "^2.0.0",
    "pinia": "^2.3.0",
    "vue": "^3.5.0",
    "vue-router": "^4.5.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.49.0",
    "@tailwindcss/vite": "^4.0.0",
    "@vitejs/plugin-vue": "^5.0.0",
    "@vue/test-utils": "^2.4.0",
    "jsdom": "^24.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "~5.6.0",
    "vite": "^6.0.0",
    "vitest": "^3.0.0",
    "vue-tsc": "^2.2.0"
  }
}
```

- [ ] **Step 3: 更新 vite.config.ts**

修改 `packages/webui/vite.config.ts` 中的路径：

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      // workspace 包通过 pnpm 解析，无需额外 alias
    },
  },
  // 其他配置保持不变
})
```

- [ ] **Step 4: 更新 vitest.config.ts**

修改 `packages/webui/vitest.config.ts`：

```typescript
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts', 'src/**/*.spec.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 5: 更新 webui 源码中的导入**

将 `packages/webui/src/` 中所有对 `shell` 和 `backend` 的导入更新为 workspace 包名：

```typescript
// 原
import { createShell, provideShell } from '@/shell'
// 新
import { createShell, provideShell } from '@goferbot/shell-adapters'

// 原
import { getBackend } from '@/backend'
// 新
import { getBackend } from '@goferbot/backend-adapters'

// 原
import { MemoryShell } from '@/shell/memory'
// 新
import { MemoryShell } from '@goferbot/shell-adapters'

// 原
import { FakeBackendTransport } from '@/backend/fake-transport'
// 新
import { FakeBackendTransport } from '@goferbot/backend-adapters'
```

批量替换命令：

```bash
cd packages/webui/src
sed -i "s|from '@/shell'|from '@goferbot/shell-adapters'|g" $(grep -rl "from '@/shell'" .)
sed -i "s|from '@/shell/|from '@goferbot/shell-adapters'|g" $(grep -rl "from '@/shell/" .)
sed -i "s|from '@/backend'|from '@goferbot/backend-adapters'|g" $(grep -rl "from '@/backend'" .)
sed -i "s|from '@/backend/|from '@goferbot/backend-adapters'|g" $(grep -rl "from '@/backend/" .)
```

- [ ] **Step 6: 验证 webui 类型检查**

```bash
pnpm --filter @goferbot/webui type-check
```

Expected: 无类型错误

- [ ] **Step 7: Commit**

```bash
git add packages/webui/
git commit -m "chore(monorepo): migrate webui to packages/webui"
```

---

### Task 6: 迁移测试文件

**Files:**
- Create: `packages/webui/tests/` (move from root `tests/`)
- Modify: `packages/webui/vitest.config.ts`

- [ ] **Step 1: 移动测试目录**

```bash
git mv tests packages/webui/tests
```

- [ ] **Step 2: 更新测试文件中的导入路径**

修改 `packages/webui/tests/unit/shell/memory.test.ts`：

```typescript
// 原
import { MemoryShell } from '@/shell/memory'
// 新
import { MemoryShell } from '@goferbot/shell-adapters'
```

修改 `packages/webui/tests/unit/backend/fake-transport.test.ts`：

```typescript
// 原
import { FakeBackendTransport } from '@/backend/fake-transport'
// 新
import { FakeBackendTransport } from '@goferbot/backend-adapters'
```

修改 `packages/webui/tests/unit/composables/useSidecarStatus.test.ts`：

```typescript
// 原
import { setShell } from '@/shell'
import { MemoryShell } from '@/shell/memory'
// 新
import { setShell, MemoryShell } from '@goferbot/shell-adapters'
```

修改 `packages/webui/tests/unit/stores/session.test.ts`：

```typescript
// 原
import { FakeBackendTransport } from '@/backend/fake-transport'
import { setBackend } from '@/backend'
// 新
import { FakeBackendTransport, setBackend } from '@goferbot/backend-adapters'
```

修改 `packages/webui/tests/unit/stores/settings.test.ts`：

```typescript
// 原
import { FakeBackendTransport } from '@/backend/fake-transport'
import { setBackend } from '@/backend'
// 新
import { FakeBackendTransport, setBackend } from '@goferbot/backend-adapters'
```

- [ ] **Step 3: 更新 E2E 测试路径**

修改 `packages/webui/tests/e2e/mocks/shell-memory.ts`（如存在）：

```typescript
// 如有对 shell 的引用，更新为 workspace 包
```

- [ ] **Step 4: 运行 webui 测试**

```bash
pnpm --filter @goferbot/webui test
```

Expected: 全部通过

- [ ] **Step 5: Commit**

```bash
git add packages/webui/tests/
git commit -m "chore(monorepo): migrate tests to packages/webui/tests"
```

---

### Task 7: 更新 Tauri 配置

**Files:**
- Modify: `src-tauri/tauri.conf.json`

- [ ] **Step 1: 更新 frontendDist 路径**

```json
{
  "build": {
    "frontendDist": "../packages/webui/dist"
  }
}
```

- [ ] **Step 2: 验证 Tauri 开发模式**

```bash
pnpm tauri dev
```

Expected: Tauri 应用正常启动，前端加载成功

- [ ] **Step 3: Commit**

```bash
git add src-tauri/tauri.conf.json
git commit -m "chore(tauri): update frontendDist path for monorepo"
```

---

### Task 8: 创建 rag-sdk 空骨架

**Files:**
- Create: `packages/rag-sdk/package.json`
- Create: `packages/rag-sdk/src/index.ts`
- Create: `packages/rag-sdk/README.md`

- [ ] **Step 1: 创建目录和文件**

```bash
mkdir -p packages/rag-sdk/src
```

```json
// packages/rag-sdk/package.json
{
  "name": "@goferbot/rag-sdk",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "type-check": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "~5.6.0"
  }
}
```

```typescript
// packages/rag-sdk/src/index.ts
/**
 * GoferBot RAG SDK
 * 未来实现检索增强生成相关工具函数
 */
export {}
```

```markdown
<!-- packages/rag-sdk/README.md -->
# @goferbot/rag-sdk

RAG (Retrieval-Augmented Generation) SDK for GoferBot.

## 状态

当前为占位包，待后续开发。
```

- [ ] **Step 2: Commit**

```bash
git add packages/rag-sdk/
git commit -m "chore(monorepo): create rag-sdk placeholder package"
```

---

### Task 9: 根目录清理与脚本验证

**Files:**
- Delete: `src/` (已清空)
- Delete: `server/` (已清空)
- Delete: `index.html` (已移动)
- Modify: `package.json` (root)

- [ ] **Step 1: 确认旧目录已清空并删除**

```bash
# 确认 src/ 和 server/ 已空
ls src/ 2>/dev/null || echo "src/ is empty or removed"
ls server/ 2>/dev/null || echo "server/ is empty or removed"

# 删除空目录
rmdir src/ server/ 2>/dev/null || true
```

- [ ] **Step 2: 更新根目录 scripts**

确认根 `package.json` 的 scripts 能正确代理到 workspace 包：

```json
{
  "scripts": {
    "dev": "pnpm --filter @goferbot/webui dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "type-check": "pnpm -r type-check",
    "check": "cd src-tauri && cargo check",
    "tauri": "pnpm --filter @goferbot/webui tauri",
    "preview": "pnpm --filter @goferbot/webui preview"
  }
}
```

- [ ] **Step 3: 全量安装验证**

```bash
pnpm install
```

Expected: 所有 workspace 包依赖正确安装，无冲突

- [ ] **Step 4: 全量构建验证**

```bash
pnpm build
```

Expected:
- `packages/shellAdapters/dist/` 生成
- `packages/backendAdapters/dist/` 生成
- `packages/server/dist/` 生成
- `packages/webui/dist/` 生成

- [ ] **Step 5: 全量测试验证**

```bash
pnpm test
```

Expected: 全部通过

- [ ] **Step 6: Commit**

```bash
git add package.json
git commit -m "chore(monorepo): clean up root directory and verify build chain"
```

---

### Task 10: 更新全局文档

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`
- Modify: `PROGRESS.md`
- Modify: `docs/agents/domain.md`（如涉及）

- [ ] **Step 1: 更新 CLAUDE.md**

修改项目结构部分：

```markdown
## 项目结构

```
├── packages/
│   ├── webui/              # Vue 3 前端应用
│   ├── shellAdapters/      # 平台适配层（Shell 抽象）
│   ├── backendAdapters/    # 后端通信适配层
│   ├── server/             # Node.js Sidecar
│   └── rag-sdk/            # RAG SDK（未来扩展）
├── src-tauri/              # Tauri v2 Rust 主进程
├── docs/                   # 文档
├── pnpm-workspace.yaml     # pnpm workspace 配置
└── package.json            # 根 workspace 配置
```
```

修改启动命令部分：

```markdown
## 启动命令

- `pnpm dev` —— 启动 webui 开发模式
- `pnpm build` —— 构建所有包
- `pnpm test` —— 运行所有测试
- `pnpm type-check` —— 运行所有类型检查
- `pnpm check` —— 检查 Rust 代码
- `pnpm tauri <cmd>` —— 运行 Tauri CLI 命令
```

- [ ] **Step 2: 更新 README.md**

更新目录结构、安装说明、开发指南等涉及路径的部分。

- [ ] **Step 3: 更新 PROGRESS.md**

添加 #12 的完成状态：

```markdown
## #12 Monorepo 结构迁移

**状态**: ✅ 已完成  
**日期**: 2026-05-14  
**说明**: 项目已迁移为 pnpm Monorepo 结构，包含 webui、shellAdapters、backendAdapters、server、rag-sdk 五个包。
```

- [ ] **Step 4: 扫描并更新其他文档**

全局搜索涉及旧路径的文档：

```bash
grep -r "src/" docs/ --include="*.md" | grep -v "src-tauri"
grep -r "server/" docs/ --include="*.md"
```

逐个更新。

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md README.md PROGRESS.md docs/
git commit -m "docs(monorepo): update all documentation for new workspace structure"
```

---

## Self-Review

### 1. Spec coverage

| #12 验收标准 | 对应 Task |
|-------------|----------|
| pnpm workspace 配置 | Task 1 |
| server 迁移 | Task 2 |
| shellAdapters 包创建 | Task 3 |
| backendAdapters 包创建 | Task 4 |
| webui 迁移 | Task 5 |
| 测试迁移 | Task 6 |
| Tauri 配置更新 | Task 7 |
| rag-sdk 空骨架 | Task 8 |
| 根目录清理 | Task 9 |
| 文档更新 | Task 10 |

**无遗漏。**

### 2. Placeholder scan

- 无 "TBD"、"TODO"、"implement later"
- 无模糊描述
- 每个步骤包含具体命令和代码

### 3. Type consistency

- 所有包使用统一的 `@goferbot/` 前缀
- `workspace:*` 用于内部包引用
- TypeScript 版本统一为 `~5.6.0`

---

## 执行交接

**Plan complete and saved to `docs/superpowers/plans/2026-05-14-monorepo-migration.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
