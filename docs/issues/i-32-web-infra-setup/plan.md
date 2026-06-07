---
id: i-32
issue: issue.md
version: 1
---

# apps/web 基建搭建 实现计划

> **For agentic workers:** 必需子技能：superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans。步骤使用复选框（`- [ ]`）语法追踪。

**目标：** 在 Monorepo 中建立 `apps/web/` 项目骨架，验证 dev/build 链路可用。

**架构：** 使用 TanStack Start CLI 初始化项目，手动调整 Vite 配置以对齐现有项目约定（代理、别名、端口），注册 pnpm workspace。不在此阶段编写业务代码。

**技术栈：** TanStack Start + React 19 + Vite 7 + Tailwind v4 + pnpm workspace

**Issue 引用：** [issue.md](./issue.md)
**Spec 引用：** [specs/feature-spec.md](./specs/feature-spec.md)
**PRD 引用：** [docs/prd/v3-frontend-migration.md](../../prd/v3-frontend-migration.md) §5.1

---

## PRD 一致性声明

| PRD 目标 | Plan 覆盖情况 | 说明 |
|----------|--------------|------|
| 建立新项目骨架，验证构建链路 | ✅ 已覆盖 | 任务 1-5 |
| `apps/web` 可运行，显示默认首页 | ✅ 已覆盖 | 任务 5（最终验证） |
| 复用现有 Vite 代理规则和 Tailwind 主题 | ✅ 已覆盖 | 任务 3（Vite 配置）+ 任务 2（复制 globals.css） |

---

## ADR 合规声明

| ADR | 涉及内容 | 符合/豁免 | 说明 |
|-----|---------|----------|------|
| ADR 0001 | 前端技术栈：Vue 3 → TanStack Start | ⚠️ 豁免 | 本次迁移正是将 ADR 中"Vue 3"更新为"TanStack Start + React"，PRD 已确认此方向 |
| ADR 0001 | 验证统一为 Zod | ✅ 符合 | 本 issue 不涉及后端 DTO，不引入新验证方案 |
| ADR 0001 | 依赖引入 | ✅ 符合 | 未引入 ADR 禁止的依赖（class-validator/class-transformer） |

---

## 文件结构

本 issue 变更以下文件：

```
新建：
├── apps/web/                       # TanStack Start 项目（CLI 生成）
│   ├── app/
│   │   ├── routes/
│   │   │   ├── __root.tsx          # 根路由（CLI 生成，微调）
│   │   │   └── index.tsx           # 默认首页（占位）
│   │   ├── router.tsx              # 路由器配置
│   │   ├── client.tsx              # 客户端入口
│   │   ├── ssr.tsx                 # SSR 入口
│   │   └── globals.css             # Tailwind + Pencil tokens
│   ├── vite.config.ts              # Vite 配置（手动调整）
│   ├── package.json                # 依赖声明
│   └── tsconfig.json               # TypeScript 配置
修改：
├── pnpm-workspace.yaml             # 添加 apps/*
├── package.json                    # 添加 dev:web 脚本
```

---

## 任务列表

### 任务 1: 使用 TanStack Start CLI 初始化项目骨架

**文件：**
- 创建：`apps/web/` 整个项目目录（CLI 生成）
- 验证：bash 命令检查目录结构

**规格引用：**
- 功能规格：[§2.1 项目初始化]、[§3 目录结构]

- [ ] **步骤 1: 编写失败测试（验证目录不存在）**

```bash
# 验证 apps/web 目录当前不存在
test ! -d apps/web && echo "RED: apps/web does not exist yet" || (echo "FAIL: apps/web already exists" && exit 1)
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`test ! -d apps/web`
预期：目录不存在（返回 0，因为没有 apps/web）

- [ ] **步骤 3: 使用 CLI 初始化项目**

```bash
cd apps
npm create @tanstack/start@latest web -- --tailwind --add-ons shadcn
cd ..
```

> **注意**：CLI 交互式选项需要处理。若 CLI 不支持完全非交互模式，则手动创建文件骨架（参考 `docs/reference/tanstack-start-guide.md` §1-2）。

- [ ] **步骤 4: 运行测试验证通过**

```bash
# 验证核心文件已生成
test -f apps/web/app/routes/__root.tsx && echo "GREEN: __root.tsx exists"
test -f apps/web/app/router.tsx && echo "GREEN: router.tsx exists"
test -f apps/web/app/client.tsx && echo "GREEN: client.tsx exists"
test -f apps/web/vite.config.ts && echo "GREEN: vite.config.ts exists"
test -f apps/web/package.json && echo "GREEN: package.json exists"
```

- [ ] **步骤 5: 验证并标记完成**

```bash
ls -la apps/web/app/routes/
ls -la apps/web/app/
```

---

### 任务 2: 复制 Tailwind 主题变量（globals.css）

**文件：**
- 修改：`apps/web/app/globals.css`
- 参考：`packages/webui/src/styles/`（Pencil tokens 定义）

**规格引用：**
- 功能规格：[§2.5 全局样式]

- [ ] **步骤 1: 编写失败测试（CSS 缺少 Pencil tokens）**

```bash
# 检查当前 globals.css 是否缺少 Pencil tokens
! grep -q "bg-surface-1" apps/web/app/globals.css && echo "RED: Pencil tokens not yet added" || (echo "FAIL: tokens already present" && exit 1)
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`grep -q "bg-surface-1" apps/web/app/globals.css`
预期：退出码 1（未找到）

- [ ] **步骤 3: 复制主题变量**

从 `packages/webui/src/styles/` 复制 CSS 变量定义（`:root` 块中的 `--color-*`、`--spacing-*` 等 Pencil tokens），追加到 `apps/web/app/globals.css` 的 `@tailwind` 指令之后。

确保包含：
- `@import "tailwindcss"` 指令
- `:root { }` 块中的 CSS 变量定义
- 主题色板：`--surface-1`, `--text-primary` 等

- [ ] **步骤 4: 运行测试验证通过**

```bash
grep -q "bg-surface-1" apps/web/app/globals.css && echo "GREEN: Pencil tokens present"
grep -q "text-text-primary" apps/web/app/globals.css && echo "GREEN: text tokens present"
```

- [ ] **步骤 5: 验证并标记完成**

确认 globals.css 包含 Tailwind v4 的 `@import "tailwindcss"` 指令和项目 CSS 变量。

---

### 任务 3: 配置 Vite（别名、代理、Tailwind v4 plugin）

**文件：**
- 修改：`apps/web/vite.config.ts`
- 参考：`docs/reference/tanstack-start-guide.md` §6 Vite 配置

**规格引用：**
- 功能规格：[§2.2 Vite 配置]

- [ ] **步骤 1: 编写失败测试（配置项缺失）**

```bash
# 验证当前 vite.config.ts 缺少 @ 别名和 /api 代理
! grep -q "'@'" apps/web/vite.config.ts && echo "RED: @ alias not configured" || echo "PARTIAL"
! grep -q "'/api'" apps/web/vite.config.ts && echo "RED: /api proxy not configured" || echo "PARTIAL"
```

- [ ] **步骤 2: 运行测试验证失败**

预期：`@` 别名和 `/api` 代理未配置

- [ ] **步骤 3: 修改 vite.config.ts**

```typescript
// apps/web/vite.config.ts
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tanstackStart(),
    viteReact(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': new URL('./app', import.meta.url).pathname,
      '~': new URL('./app', import.meta.url).pathname,
    },
  },
  server: {
    port: 1420,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'esnext',
  },
})
```

> 注意：CLI 生成的基础配置可能已包含 `tanstackStart()` 和 `viteReact()` plugin，需在此基础上添加，而非完全覆写。

- [ ] **步骤 4: 运行测试验证通过**

```bash
grep -q "'@'" apps/web/vite.config.ts && echo "GREEN: @ alias configured"
grep -q "'/api'" apps/web/vite.config.ts && echo "GREEN: /api proxy configured"
grep -q "tailwindcss" apps/web/vite.config.ts && echo "GREEN: Tailwind v4 plugin configured"
grep -q "1420" apps/web/vite.config.ts && echo "GREEN: port 1420 configured"
```

- [ ] **步骤 5: 验证并标记完成**

```bash
cat apps/web/vite.config.ts
```

---

### 任务 4: 注册 pnpm workspace 并安装依赖

**文件：**
- 修改：`pnpm-workspace.yaml`（添加 `apps/*`）
- 修改：`apps/web/package.json`（确保 name 为 `@goferbot/web`）
- 修改（可选）：根 `package.json`（添加 `dev:web` 脚本）

**规格引用：**
- 功能规格：[§2.3 pnpm workspace 注册]、[§2.4 依赖安装]

- [ ] **步骤 1: 编写失败测试（workspace 未注册）**

```bash
# 验证 pnpm-workspace.yaml 当前不含 apps/*
! grep -q "apps/" pnpm-workspace.yaml && echo "RED: apps/* not in workspace config" || (echo "FAIL: apps/* already in workspace config" && exit 1)
```

- [ ] **步骤 2: 运行测试验证失败**

预期：`pnpm-workspace.yaml` 不含 `apps/` 引用

- [ ] **步骤 3: 修改配置并安装依赖**

**3a. 修改 `pnpm-workspace.yaml`**：

```yaml
packages:
  - "packages/*"
  - "apps/*"
```

**3b. 确认 `apps/web/package.json` 中的包名**：

```json
{
  "name": "@goferbot/web",
  ...
}
```

**3c. 安装新增依赖**：

```bash
cd apps/web
pnpm add zustand alova lucide-react class-variance-authority clsx tailwind-merge
cd ../..
```

**3d. 添加根脚本**（在根 `package.json` 的 `scripts` 中）：

```json
{
  "dev:web": "pnpm --filter @goferbot/web dev"
}
```

**3e. 安装所有 workspace 依赖**：

```bash
pnpm install
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
# 验证 workspace 注册
grep -q "apps/" pnpm-workspace.yaml && echo "GREEN: apps/* in workspace config"

# 验证包名
grep -q "@goferbot/web" apps/web/package.json && echo "GREEN: package name correct"

# 验证依赖已安装
test -d apps/web/node_modules/zustand && echo "GREEN: zustand installed"
test -d apps/web/node_modules/alova && echo "GREEN: alova installed"
test -d apps/web/node_modules/lucide-react && echo "GREEN: lucide-react installed"
```

- [ ] **步骤 5: 验证并标记完成**

```bash
pnpm list --filter @goferbot/web --depth 0
```

---

### 任务 5: 构建与运行时验证

**文件：**
- 验证：构建产物 + 开发服务器

**规格引用：**
- 功能规格：[§5 验收标准映射] AC-05、AC-06

- [ ] **步骤 1: 编写失败测试（build 未验证）**

```bash
# 尝试构建（首次可能失败，输出记录）
pnpm --filter @goferbot/web build 2>&1 | tee /tmp/i32-build.log
grep -q "error" /tmp/i32-build.log && echo "RED: build has errors" || echo "Build may have succeeded - check output"
```

- [ ] **步骤 2: 运行测试验证失败/通过**

预期：查看构建输出。首次构建可能因 TypeScript 严格模式或缺失配置而报错。

- [ ] **步骤 3: 修复构建错误并验证**

常见修复项：
- `tsconfig.json` 中 `paths` 配置 `@/*` → `./app/*`
- 调整 `moduleResolution` 为 `bundler`
- 移除 `index.tsx` 中无用 import

```bash
pnpm --filter @goferbot/web build
```

- [ ] **步骤 4: 运行开发服务器验证**

```bash
# 后台启动 dev server
pnpm --filter @goferbot/web dev &
DEV_PID=$!
sleep 5

# 验证首页返回 200
curl -s -o /dev/null -w "%{http_code}" http://localhost:1420 | grep -q "200" && echo "GREEN: dev server returns 200" || echo "RED: dev server not responding"

# 停止 dev server
kill $DEV_PID 2>/dev/null
```

- [ ] **步骤 5: 最终验证并标记完成**

```bash
echo "=== i-32 最终验证 ==="
echo "1. 目录结构:"
ls apps/web/app/routes/__root.tsx apps/web/app/router.tsx apps/web/app/client.tsx && echo "  ✅ 核心文件存在"
echo "2. Vite 配置:"
grep -c "'@'" apps/web/vite.config.ts > /dev/null && echo "  ✅ @ 别名" || echo "  ❌ 缺少 @ 别名"
grep -c "'/api'" apps/web/vite.config.ts > /dev/null && echo "  ✅ /api 代理" || echo "  ❌ 缺少代理"
echo "3. Workspace:"
grep -c "apps/" pnpm-workspace.yaml > /dev/null && echo "  ✅ apps/* 已注册" || echo "  ❌ 未注册"
echo "4. Build:"
pnpm --filter @goferbot/web build > /dev/null 2>&1 && echo "  ✅ 构建成功" || echo "  ❌ 构建失败"
```

---

## 自检

### PRD 覆盖检查
- [x] §5.1 阶段一：创建目录结构 — 任务 1
- [x] §5.1 阶段一：初始化 TanStack Start — 任务 1
- [x] §5.1 阶段一：配置 Vite（代理、别名、Tailwind 4） — 任务 2 + 任务 3
- [x] §5.1 阶段一：配置 pnpm workspace — 任务 4
- [x] §5.1 阶段一：安装依赖（Zustand、alova、lucide-react） — 任务 4
- [x] §5.1 阶段一：验证构建 — 任务 5

### 规格覆盖检查
- [x] §2.1 项目初始化 — 任务 1
- [x] §2.2 Vite 配置 — 任务 3
- [x] §2.3 pnpm workspace 注册 — 任务 4
- [x] §2.4 依赖安装 — 任务 4
- [x] §2.5 全局样式 — 任务 2
- [x] §3 目录结构 — 任务 1
- [x] §5 验收标准 AC-01 ~ AC-06 — 分布在各任务验证步骤

### 占位符扫描
- 无 "TODO"、"TBD"、"稍后实现"
- 无模糊描述
- 所有步骤包含具体命令或代码块

### 类型一致性
- 本 issue 为纯基建，不涉及业务类型定义
- 所有文件路径与 spec 声明的目录结构一致
