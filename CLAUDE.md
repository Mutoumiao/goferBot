# 知识库应用（Knowledge-base）

基于 Tauri v2 的本地知识库桌面应用。用户可导入文档（Markdown、TXT 等）进行管理，并保存问答历史记录。应用数据存储在系统用户目录下的 `knowledge-base/` 文件夹中。

## 项目结构

```
├── packages/
│   ├── webui/                    # Vue 3 前端（@goferbot/webui）
│   │   ├── src/                  # Vue 组件、stores、composables
│   │   ├── dist/                 # Vite 构建产物
│   │   └── package.json          # 前端依赖
│   ├── server/                   # Node.js Sidecar（@goferbot/server）
│   │   ├── src/                  # Hono 路由、SQLite、LLM 适配器
│   │   ├── dist/                 # tsc 编译产物
│   │   └── package.json          # Sidecar 依赖
│   ├── shellAdapters/            # 平台适配层（@goferbot/shell-adapters）
│   ├── backendAdapters/          # 后端通信适配层（@goferbot/backend-adapters）
│   └── rag-sdk/                  # RAG 工具库（@goferbot/rag-sdk）
├── src-tauri/                    # Tauri Rust 后端
│   ├── src/                      # Rust 源码（lib.rs、sidecar.rs、main.rs）
│   ├── capabilities/             # Tauri v2 能力配置
│   ├── permissions/              # Tauri v2 权限定义
│   ├── gen/                      # tauri-build 自动生成文件
│   ├── Cargo.toml                # Rust 依赖
│   └── tauri.conf.json           # Tauri 配置
├── tests/                        # 根目录测试（跨包集成测试、E2E 测试）
│   ├── setup/                    # 测试配置（testglobals.ts）
│   ├── unit/                     # 单元测试
│   ├── integration/              # 集成测试
│   └── e2e/                      # E2E 测试（Playwright）
├── docs/                         # 文档
│   ├── agents/                   # Agent 技能配置
│   ├── adr/                      # 架构决策记录（ADR）
│   ├── superpowers/plans/        # 功能执行计划
│   ├── design-discussions/       # 设计讨论记录
│   ├── test-cases/               # 测试用例（按 Issue 编号）
│   └── prd-v1.md                 # 产品需求文档
├── .scratch/                     # 临时工作区
│   └── knowledge-base/
│       ├── PRD.md                # 产品需求总纲
│       └── issues/               # Issue 跟踪
├── pnpm-workspace.yaml           # pnpm workspace 配置
├── PROGRESS.md                   # 项目进度追踪
├── vitest.config.ts              # Vitest 配置（根目录）
└── package.json                  # 根包配置（workspace 聚合脚本）
```

## 技术栈

- **前端框架**：Vue 3 + TypeScript + Vite
- **桌面框架**：Tauri v2 (Rust)
- **状态管理**：Pinia
- **CSS 框架**：Tailwind CSS v4
- **测试框架**：Vitest + @vue/test-utils
- **包管理器**：pnpm
- **图标方案**：lucide-vue-next（已替换 Material Design Icons）

## 本地数据目录

应用数据存储在系统用户目录下的 `knowledge-base/` 中：

- `docs/`：用户导入的文档
- `sidecar.db`：SQLite 数据库
- `.sidecar-port`：Sidecar 监听端口
- `qa-history.json` / `config.json`：历史记录与配置

## 启动命令

根目录脚本通过 pnpm workspace 聚合各包操作：

- `pnpm dev` —— **同时启动前后端**（Sidecar + Vite dev server）
- `pnpm dev:web` —— 只启动前端（Vite dev server）
- `pnpm dev:server` —— 只启动后端 Sidecar（tsx 直接运行 TS 源码）
- `pnpm dev:tauri` —— Tauri 开发模式（Vite + 独立 Vue Devtools 进程）
- `pnpm build` —— 构建 webui 生产版本
- `pnpm preview` —— 预览 webui 生产构建
- `pnpm test` —— 运行根目录单元测试（Vitest）
- `pnpm test:integration` —— 运行集成测试
- `pnpm test:e2e` —— 运行 E2E 测试（Playwright）
- `pnpm type-check` —— 对所有 workspace 包运行 TypeScript 类型检查
- `pnpm check` —— 检查 Rust 代码（`cargo check`）
- `pnpm tauri <cmd>` —— 运行 Tauri CLI 命令（如 `pnpm tauri dev`、`pnpm tauri build`）
- `pnpm -r build` —— 构建所有 workspace 包
- `pnpm --filter @goferbot/server build` —— 单独构建 server 包

## 测试验证

- **框架**：Vitest（单元测试）、Playwright（E2E 测试）
- **单元测试**：`tests/unit/**/*.test.ts`
- **集成测试**：`tests/integration/**/*.spec.ts`
- **E2E 测试**：`tests/e2e/specs/**/*.spec.ts`
- **运行**：`pnpm test`（单元）、`pnpm test:integration`（集成）、`pnpm test:e2e`（E2E）

## 注意事项

### Monorepo 开发规范

本项目采用 pnpm workspace 管理多包依赖。每次切换分支或合并后，在主仓库执行：

```bash
pnpm install
pnpm -r build
pnpm test && pnpm test:integration && pnpm type-check
```

（pnpm v10 默认忽略构建脚本，better-sqlite3 需手动下载原生绑定：`cd node_modules/better-sqlite3 && npx prebuild-install --download`）

### Shell 环境偏好

Agent **必须**使用 Bash/POSIX 语法，禁止 PowerShell 特有语法（`$env:VAR`、`Select-Object`、`Where-Object` 等）。例外情况需先说明原因并获许可。

## UI 组件规范

### 基础组件

项目使用 [shadcn-vue](https://www.shadcn-vue.com/) 作为基础 UI 组件库，位于 `packages/webui/src/components/ui/`。

**引入新组件**：
```bash
cd packages/webui
npx shadcn-vue@latest add <component>
```

**定制规则**：
- 最多定制到层级 2（加插槽、调整布局）
- 不魔改 shadcn 源码实现复杂业务逻辑
- 颜色使用 Pencil tokens（`bg-surface-1`, `text-text-primary` 等）
- 保持 focus ring、键盘导航、ARIA 属性

### Class 管理

全项目统一使用 `cn()` + `class-variance-authority`：

```typescript
import { cn } from '@/lib/utils'
import { cva } from 'class-variance-authority'

const variants = cva('base-classes', {
  variants: { size: { sm: 'h-8', default: 'h-10' } }
})

<div :class="cn(variants({ size }), props.class)" />
```

## 编码准则

1. **编码前思考** — 不明确时提问；呈现多种解释；反对过度复杂的方案。
2. **简洁优先** — 最小代码量解决问题；不臆测功能；不为不可能的情况加错误处理。
3. **精准修改** — 不碰无关代码；匹配现有风格；只删除**你的改动**导致的孤立代码。
4. **目标驱动** — 将任务转化为可验证目标（如"修复 bug → 写复现测试并让其通过"）。多步骤任务给出简要计划与验证检查点。

## ⚠️ 废弃文档声明 – 请勿使用

以下目录包含项目早期的**过时内容**，已被**弃用**，不再适用于当前开发：

- `docs/archived/plans/` — 旧功能执行计划
- `docs/archived/adr/` — 旧架构决策记录（0001~0006，除 0004 外）
- `docs/archived/issues/` — 旧 Issue 跟踪文件（#01~#13）

**当前开发必须仅参考**：
- 最新架构规格：`docs/superpowers/specs/2026-05-15-cloud-native-rearchitecture.md`
- 最新 ADR：`docs/adr/0004-cloud-native-rearchitecture.md`
- `PROGRESS.md`（项目进度与当前状态）
- `docs/interview-architecture-evolution.md`（架构演进面试指南）

**对 AI 代理的约束**：
- 生成代码、编写测试或回答问题时，**必须忽略**废弃目录中的任何文件。
- 所有实现必须基于当前架构 spec 编写，不得参考归档目录中的旧用例。

---

## Agent skills

- **Issue tracker**：`.scratch/` 目录下的 Markdown issue 文件（当前已归档，见上方声明）。详见 `docs/agents/issue-tracker.md`。
- **Triage labels**：标准标签词汇，详见 `docs/agents/triage-labels.md`。
- **Domain docs**：单上下文仓库，`CONTEXT.md` 和 `docs/adr/` 位于根目录。详见 `docs/agents/domain.md`。
- **ADR**：`docs/adr/` 目录下的编号决策记录。涉及架构变动前应先查阅 **0004-cloud-native-rearchitecture.md**。
- **执行计划**：`docs/superpowers/plans/` 目录下按日期组织的实现方案。执行前应先阅读。
- **进度追踪**：`PROGRESS.md` 记录所有 Issue 的执行状态与后续计划，开发前应先查阅当前进度。
