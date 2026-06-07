# GoferBot 前端架构迁移 PRD

## 1. 项目概述

### 1.1 背景

GoferBot 当前前端基于 Vue 3 + Vite 构建，位于 `packages/webui`。随着产品演进，需要引入 BlockNote 富文本编辑器（React 生态），同时后续需开发独立的后台管理端。本次迁移将前端从 Vue 迁移至 React 生态，并重构 Monorepo 目录结构以支持多前端应用长期演进。

### 1.2 目标

- 将用户端前端从 Vue 3 迁移至 TanStack Start + React + shadcn/ui
- 建立支持多前端应用的 Monorepo 架构（用户端 + 后台管理端）
- 保留并复用现有 Vite 配置、代理规则、Tailwind 主题
- 为后续后台管理端（Ant Design Pro）预留独立技术栈空间

### 1.3 非目标

- 不迁移后端（NestJS 保持现状）
- 不迁移 RAG SDK（保持现状）
- 不改造数据库或 API 契约
- 本次不涉及后台管理端实际开发（仅预留架构）

---

## 2. 架构决策

### 2.1 目录结构

采用统一的 `packages/` 结构，所有项目（应用与共享库）集中在同一层级，便于管理：

```
knowledge-base/
├── packages/
│   ├── web/                      # 用户端前端（本次迁移目标）
│   │   ├── src/                  # TanStack Start 源码目录
│   │   │   ├── routes/           # 页面路由
│   │   │   ├── overlays/         # 弹窗系统（Dialog / ContextMenu）
│   │   │   │   ├── dialogs/      # Dialog 组件
│   │   │   │   ├── context-menus/# ContextMenu 组件
│   │   │   │   ├── host/         # OverlayHost 渲染宿主
│   │   │   │   ├── services/     # openDialog / openContextMenu 服务
│   │   │   │   ├── hooks/        # useOverlay
│   │   │   │   └── types/        # 类型定义
│   │   │   ├── api/              # API 集中管理（按业务域分类）
│   │   │   │   ├── auth.ts       # 认证相关 API
│   │   │   │   ├── chat.ts       # 聊天相关 API
│   │   │   │   └── kb.ts         # 知识库相关 API
│   │   │   ├── components/       # 业务组件
│   │   │   │   ├── chat/         # 聊天相关组件
│   │   │   │   ├── sidebar/      # 侧边栏
│   │   │   │   └── tab-bar/      # 标签栏
│   │   │   ├── stores/           # Zustand stores
│   │   │   ├── utils/            # 共享工具
│   │   │   │   ├── server.ts     # alova 实例配置
│   │   │   │   └── cn.ts         # class 合并工具
│   │   │   └── globals.css       # Tailwind + Pencil tokens
│   │   ├── tests/                # 单元测试
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   └── tsconfig.json
│   ├── admin/                    # 后台管理端（未来建设）
│   │   ├── src/
│   │   ├── package.json
│   │   └── vite.config.ts
│   ├── server/                   # NestJS API（保持现状）
│   ├── rag-sdk/                  # RAG 工具库（保持现状）
│   └── data/                     # 前后端共享类型与 Zod Schema
│       ├── src/
│       │   ├── schemas/          # Zod schema（auth/kb/chat 等业务域）
│       │   └── types/            # z.infer 导出的 TS 类型
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/
└── package.json                  # workspace root
```

### 2.2 决策依据

| 考量维度 | 选择 | 理由 |
|----------|------|------|
| 前端框架 | TanStack Start | 保留 Vite 生态、路由守卫接近 Vue Router、支持 shadcn/ui |
| UI 库（用户端） | shadcn/ui | 与 Tailwind 深度集成、组件可定制、社区活跃 |
| UI 库（管理端） | Ant Design Pro | B 端组件成熟度高、ProComponents 节省开发成本 |
| 状态管理 | Zustand | 轻量、TypeScript 友好、Pinia 用户学习成本低 |
| 数据获取 | alova | 集中化 API 管理、hooks 统一 loading/error 状态、内置缓存去重 |
| 构建工具 | Vite | 复用现有配置、TanStack Start 原生支持 |
| Monorepo 结构 | packages/ 统一管理 | 与现有 vitest 配置一致、pnpm workspace 无需额外配置、简化目录导航 |

### 2.3 不采用的方案

| 方案 | 放弃原因 |
|------|----------|
| Next.js | 需放弃 Vite 配置、App Router 与 Vue Router 概念差异大、SSR 非必需 |
| 在 Vue 中嵌入 React | 短期可行但技术债累积，无法支持后续 React 生态扩展 |
| 根目录 `app/` | 破坏 Monorepo 一致性、与 Next.js 路由目录命名冲突、多应用时层级混乱 |
| 全放 `packages/` | ~~`packages` 语义为共享库，与应用混放层级不清晰~~ **已采纳**：统一 `packages/` 更利于 vitest 配置一致性和 pnpm workspace 管理，实施后验证可行 |

---

## 3. 技术栈

### 3.1 用户端（packages/web）

| 层级 | 技术 | 版本 |
|------|------|------|
| 框架 | TanStack Start | latest |
| 路由 | TanStack Router | latest |
| UI 组件 | shadcn/ui | latest |
| 样式 | Tailwind CSS v4 | ^4.1.18 |
| 状态管理 | Zustand | latest |
| 数据获取 | alova（请求库、缓存、状态管理） | latest |
| 图标 | lucide-react | latest |
| 构建 | Vite | ^7.0.0 |
| 测试 | Vitest + React Testing Library | latest |

### 3.2 管理端（packages/admin）——预留

| 层级 | 技术 | 说明 |
|------|------|------|
| 框架 | React + Vite | 独立技术栈 |
| UI 库 | Ant Design Pro | B 端成熟方案 |
| 状态管理 | 待定 | 根据团队偏好选择 |

### 3.3 共享层（packages/*）

| 包 | 技术 | 说明 |
|----|------|------|
| server | NestJS 10 + Fastify | 保持现状 |
| rag-sdk | TypeScript | 保持现状 |
| data | Zod + TypeScript | 前后端共享 Schema 与类型（单源真相） |

---

## 4. 迁移范围

### 4.1 代码资产统计（基于现有 packages/webui）

| 类型 | 数量 | 说明 |
|------|------|------|
| `.vue` 单文件组件 | 124 | 全部需重写为 TSX |
| `.ts` 文件 | 47 | 部分可复用 |
| 页面视图 | 3 | LoginView、RegisterView、ChatView |
| 布局 | 1 | AuthenticatedLayout |
| 业务组件 | ~20 | Chat、KnowledgeBase、History、Settings 等 |
| UI 组件（shadcn-vue） | ~80 | 替换为 shadcn/ui React 版 |
| Pinia Store | 6 | auth、session、settings、knowledgeBase、tabs、file |
| Composables | 3 | useAuthForm、useDialog、useContextMenu |
| Overlay 系统 | ~10 | 自定义 Dialog/ContextMenu 动态挂载 |
| 总代码行数 | ~10,500 | src 目录下 .vue + .ts |

### 4.2 可复用资产

| 资产 | 复用方式 |
|------|----------|
| `types/index.ts` | 直接拷贝 |
| `lib/utils.ts`（`cn` 函数） | 直接拷贝 |
| `utils/markdown.ts` | 直接拷贝 |
| Tailwind 主题变量 | 复制到 `packages/web/app/globals.css` |
| 业务逻辑（数据处理） | 提取到独立 `.ts` 文件后复用 |

### 4.3 必须重写的部分

| 模块 | 工作量 | 复杂度 |
|------|--------|--------|
| Vue SFC → TSX | 2-3 周 | 中 |
| shadcn-vue → shadcn/ui | 1-1.5 周 | 低（体力活） |
| Pinia → Zustand | 2 天 | 低 |
| Vue Router → TanStack Router | 2-3 天 | 中 |
| Overlay 系统（Teleport → Portal） | 2-3 天 | 中 |
| API 层重建（fetch/XHR → alova + 集中化） | 1-2 天 | 低 |
| 测试（Vue Test Utils → RTL） | 2-3 天 | 低 |

---

## 5. 迁移计划

### 5.0 总体进度（2026-06-07 更新）

| 阶段 | 完成度 | 已关闭 Issue | 进行中 Issue | 状态 |
|------|--------|-------------|-------------|------|
| §5.1 基建搭建 | **100%** | i-32 | — | ✅ 完成 |
| §5.2 核心能力 | **80%** | f-33, f-34 | f-40~f-43（4 store 补全） | ⚠️ 主体完成，缺 store 层 |
| §5.3 功能页面 | **25%** | — | f-44~f-49（6 个深化） | 🔴 骨架级，交互未补 |
| §5.4 UI 组件库 | **0%** | — | f-38 | ⬜ 84 组件待替换 |
| §5.5 测试打磨 | **5%** | — | f-39 | ⬜ 仅 tsc+build 通过 |
| **整体** | **~30%** | **3 closed** | **15 open** | 🔴 地基完成，功能待建 |

**代码量对比**：

| 指标 | 旧 Vue (`packages/webui`) | 新 React (`packages/web`) | 迁移率 |
|------|--------------------------|--------------------------|--------|
| 源文件 | 171 (.vue+.ts) | 31 (.tsx+.ts) | 18% |
| 页面/组件 | 124 | 18 | 15% |
| Pinia/Zustand Store | 6 | 3 (+4 待建) | 50% |
| shadcn UI 组件 | 84 | 0 | 0% |
| API 方法 | 分散在各组件 | 15（集中管理） | ✅ 架构升级 |
| 单元测试 | ~50 条（估算） | 13 条 | ~25% |

**关键缺口**：

| 类别 | 数量 | 具体 |
|------|------|------|
| 缺失 Store | 4 | session, settings, file, tabs（Pinia → Zustand） |
| 缺失组件 | ~100 | 84 shadcn/ui + ~16 业务组件（文件上传、KbSelector、ChatErrorCard 等） |
| 未实现功能 | 8 | SSE 流式、会话管理、文件上传、KB CRUD、Settings 表单、BlockNote、E2E 适配、旧代码删除 |

**剩余 Issue 依赖关系**：

```
阶段二补全（P0，可并行）
  f-40 session store  ──┬──→ f-44 SSE 流式 ──┬──→ f-45 会话管理
  f-41 settings store ──→ f-48 Settings 表单   │
  f-42 file store ──────→ f-46 文件上传 ──→ f-47 KB CRUD
  f-43 tabs store                               │
                        └──→ f-49 BlockNote ────┘

阶段四+五（P2，P0/P1 完成后）
  f-38 UI 组件库（84 shadcn 替换）
  f-39 测试+清理（E2E 适配 + 删除 packages/webui）
```

> **下一步**：按 f-41 → f-42 → f-43 → f-40 → f-44 → f-45 → f-46 → f-47 → f-48 → f-49 顺序推进。
> **生成新 issue 时**：以本表为基准，从 §5.6-§5.8 中提取待办项，遵循现有编号体系（全局递增，当前最大 f-49）。

### 5.1 阶段一：基建搭建（第 1 周） ✅ 已完成

> **完成度**：100% | **对应 issue**：i-32（closed） | **验收**：构建✅ 类型检查✅ 测试✅

**目标**：建立新项目骨架，验证构建链路

| 任务 | 详情 |
|------|------|
| 创建目录结构 | `packages/web/`、`packages/admin/`（空壳） |
| 初始化 TanStack Start | `npm create @tanstack/start@latest --tailwind --add-ons shadcn` |
| 配置 Vite | 复用代理规则（`/api` → `localhost:3000`）、路径别名（`@/`）、Tailwind 4 |
| 配置 pnpm workspace | `pnpm-workspace.yaml` 已包含 `packages/*`，无需额外配置 |
| 安装依赖 | Zustand、alova、lucide-react |
| 验证构建 | `pnpm dev:web` 能正常启动并代理到后端 |

**产出**：`packages/web` 可运行，显示默认首页

### 5.2 阶段二：核心能力迁移（第 2-3 周） ⚠️ 部分完成

> **完成度**：~80% | **对应 issue**：f-33（closed）+ f-34（closed） | **缺口**：4 个 Pinia Store 未迁移（session/settings/file/tabs），参见 §5.6 阶段二补全

**目标**：迁移鉴权、布局、核心页面

| 任务 | 详情 | 状态 |
|------|------|------|
| 迁移 `lib/utils.ts` | `cn` 函数、类型工具 | ✅ |
| 迁移 `types/` | 全局类型定义（→ `packages/data/`） | ✅ |
| 创建 `packages/data/` | 前后端共享 Zod schema + TS 类型（单源真相），先抽 auth 域验证链路 | ✅ |
| 创建 `utils/server.ts` | alova 实例配置（baseURL、拦截器、token 刷新、缓存策略） | ✅ |
| 创建 `api/` 目录 | 基于共享类型编写 API 方法（auth/chat/knowledge-base 等） | ✅ |
| 搭建 Zustand Store | auth Store（登录状态、token 管理） | ✅ |
| 创建根路由 `__root.tsx` | 全局布局、Head 配置 | ✅ |
| 创建 `/login` 页面 | 登录表单（无鉴权，最简单） | ✅ |
| 创建 `/register` 页面 | 注册表单 | ✅ |
| 创建 `/app` 布局路由 | AuthenticatedLayout（Sidebar + TabBar） | ✅ |
| 实现路由守卫 | `beforeLoad` 中检查鉴权状态 | ✅ |
| 迁移 Overlay 系统 | React Portal + Zustand 替代 Teleport，复用命令式调用设计 | ✅ |
| 搭建 session Store | Pinia `session.ts` → Zustand（会话列表、活跃会话管理） | ❌ |
| 搭建 settings Store | Pinia `settings.ts` → Zustand（用户配置持久化） | ❌ |
| 搭建 file Store | Pinia `file.ts` → Zustand（文件上传状态管理） | ❌ |
| 搭建 tabs Store | Pinia `tabs.ts` → Zustand（标签页状态管理） | ❌ |

**产出**：登录/注册/布局可正常工作，鉴权流程打通

### 5.3 阶段三：功能页面迁移（第 4-5 周） 🔴 骨架完成，交互待补

> **完成度**：~25% | **对应 issue**：f-35（open）+ f-36（open）+ f-37（open） | **缺口**：见 §5.3 各页面详细状态

**目标**：逐个迁移业务页面

| 优先级 | 页面 | 当前状态 | React 实现 | 缺失功能 |
|--------|------|---------|-----------|---------|
| P0 | ChatView | ⚠️ 骨架 | `routes/app/chat.tsx` + ChatInput + MessageBubble | SSE 流式接收、会话创建/切换/删除、KbSelector、ChatErrorCard、BlockNote 集成 |
| P1 | KnowledgeBasePage | ⚠️ 列表 | `routes/app/kb.tsx` | 文件上传、BreadcrumbNav、FileManager、FileGridItem、KB CRUD 完整 |
| P1 | HistoryPage | ✅ 已实现 | `routes/app/history.tsx` | 搜索/筛选（后端 API 层面） |
| P2 | SettingsPage | ⚠️ 仅用户信息 | `routes/app/settings.tsx` | 配置表单、未保存提示 |
| P2 | RecycleBinPage | ⚠️ 列表+删除 | `routes/app/recycle-bin.tsx` | 恢复功能（需后端 API） |

**策略**：
- 每个页面迁移时同步替换涉及的 shadcn-vue 组件
- 先保证功能可用，再细化样式对齐
- 每完成一个页面，在本地验证与后端的接口连通性

### 5.4 阶段四：UI 组件库收尾（第 6 周） ⬜ 未开始

> **完成度**：0% | **对应 issue**：f-38（open） | **量级**：84 个 shadcn-vue 组件 → shadcn/ui React 组件

**目标**：替换剩余 shadcn-vue 组件，统一样式

| 任务 | 详情 | 状态 |
|------|------|------|
| 梳理未替换组件 | 对比 `components/ui/` 目录（84 个） | ⬜ |
| 批量替换 | 使用 shadcn/ui CLI 安装对应组件 | ⬜ |
| 样式对齐 | 检查 `:deep()` 样式穿透的替代方案 | ⬜ |
| 主题验证 | 确认 Tailwind 变量与现有设计一致 | ⬜ |

### 5.5 阶段五：测试与打磨（第 7 周） ⬜ 未开始

> **完成度**：~5% | **对应 issue**：f-39（open） | **已通过**：tsc✅ build✅

| 任务 | 详情 | 状态 |
|------|------|------|
| 单元测试迁移 | Vue Test Utils → React Testing Library（当前仅 13 条） | ⬜ |
| E2E 测试适配 | Playwright 脚本更新（选择器从 Vue 改为 React） | ⬜ |
| 类型检查 | `pnpm type-check` 全量通过 | ✅ |
| 构建验证 | `pnpm build` 产物正常 | ✅ |
| 删除旧代码 | 移除 `packages/webui` | ⬜ |
| 更新文档 | README、开发脚本、环境变量说明 | ⬜ |

### 5.6 阶段二补全：缺失 Store 迁移（P0 优先级）

> **原因**：阶段二实施中遗漏了 4 个 Pinia Store 的迁移，block 了阶段三的页面交互深化。
> **量级**：每个 Store ≤ 1 天。
> **完成度**：0%（4/4 待做）

| 编号 | Store | 旧文件 | 新文件 | 职责 |
|------|-------|--------|--------|------|
| f-40 | session | `packages/webui/src/stores/session.ts` | `packages/web/src/stores/chat.ts`（扩展） | 会话列表、活跃会话、CRUD 状态 |
| f-41 | settings | `packages/webui/src/stores/settings.ts` | `packages/web/src/stores/settings.ts`（新建） | 用户配置持久化、未保存状态 |
| f-42 | file | `packages/webui/src/stores/file.ts` | `packages/web/src/stores/file.ts`（新建） | 文件上传进度、队列管理 |
| f-43 | tabs | `packages/webui/src/stores/tabs.ts` | `packages/web/src/stores/tabs.ts`（新建） | 标签页列表、切换、关闭 |

### 5.7 阶段三深化：页面交互补全（P1 优先级）

> **量级**：ChatView 最重（~5 天），其余各 1-3 天。

| 编号 | 目标 | 涉及文件 | 关键功能 |
|------|------|---------|---------|
| f-44 | Chat SSE 流式 | `routes/app/chat.tsx` | `useSSE` hook、流式接收、错误重连、loading 动画 |
| f-45 | Chat 会话管理 | `routes/app/chat.tsx` + `api/chat.ts` | 新建/切换/删除/重命名会话、KbSelector |
| f-46 | KB 文件上传 | `routes/app/kb.tsx` + 新组件 | 拖拽上传、FileManager、FileGridItem |
| f-47 | KB CRUD | `routes/app/kb.tsx` + `api/kb.ts` | 创建/编辑/删除 KB、BreadcrumbNav |
| f-48 | Settings 表单 | `routes/app/settings.tsx` | 配置项表单、Zod 验证、未保存提示 |
| f-49 | BlockNote 集成 | `components/chat/EditorPlaceholder.tsx` | 富文本编辑器替换纯文本输入 |

### 5.8 阶段四+五：组件库 + 收尾（P2 优先级）

> 阶段四（f-38）和阶段五（f-39）保持原计划不变，待 P0/P1 完成后推进。

---

## 6. 关键设计决策

### 6.1 鉴权方案

**现状**：JWT + localStorage，Pinia Store 管理

**迁移后**：
- 第一阶段：保持 JWT + localStorage，用 Zustand 替代 Pinia
- 第二阶段（可选）：迁移至 cookie + `createServerFn`，支持 SSR 鉴权
- Token 自动刷新：在 `utils/server.ts` 的 alova `responded.onError` 中实现 401 拦截 + refresh + 请求重放队列

**Token 刷新机制设计**：

```
请求 → 401 → 检查是否正在刷新
              ├─ 否 → 调 /api/auth/refresh → 成功 → 通知排队请求重放 → 重放当前请求
              │                                └ 失败 → 清 token → 跳 /login
              └─ 是 → 将当前请求加入等待队列，刷新完成后自动重放
```

核心关键点：
- `isRefreshing` 标记防止多个 401 并发调 refresh
- `refreshSubscribers` 队列暂存等待刷新的请求，刷新成功后逐一重放
- 刷新失败时清空队列 + 清除 token + 跳转登录页
- 此逻辑封装在 `utils/server.ts` 的 alova 实例中，对业务组件完全透明，token 过期时组件只需处理 error 状态

**理由**：
- 保持现状可降低迁移风险
- 后续如需 SSR，再逐步迁移到服务端 session
- Token 刷新逻辑集中在 alova 实例层，业务代码零感知

### 6.2 数据获取与 API 管理

**现状**：`api/client.ts` 纯客户端 fetch + XHR 封装。API 调用地址分散在各 UI 组件和页面中，缺乏集中管理，URL 变更时需要搜索全部组件逐一修改，可读性与可维护性差。

**迁移后**：
- 引入 **alova** 替代 fetch/XHR 封装，由 `utils/server.ts` 统一配置实例（拦截器、缓存、错误处理、token 注入）
- 所有 API 调用收拢到 `api/` 目录，按业务域分文件管理（`auth.ts`、`chat.ts`、`knowledge-base.ts` 等）
- 每个 API 文件内导出类型化的 method 工厂函数，业务组件直接导入调用
- alova 的 `useRequest` / `useWatcher` / `useFetcher` 等 hooks 统一管理 loading/data/error 状态，不再手动维护
- 缓存与请求去重由 alova 内置能力处理

**目录结构**：
```
app/api/
  types/                  # 请求/响应 DTO 类型定义
    auth.ts               #   LoginRequest, AuthResponse 等
    knowledge-base.ts     #   KbCreateDTO, KbListResponse 等
  auth.ts                 # login(), logout(), getMe() 等
  knowledge-base.ts       # getKbList(), createKb(), deleteKb() 等
  chat.ts                 # sendMessage(), getHistory() 等

app/utils/
  server.ts               # alova 实例创建（baseURL/拦截器/缓存策略）
```

**调用方式**（业务组件中）：
```tsx
import { useRequest } from 'alova/client'
import { getKbList } from '@/api/knowledge-base'

function KBListPage() {
  const { data, loading, error } = useRequest(
    () => getKbList({ page: 1, pageSize: 20 }),
    { immediate: true }
  )
  // ...
}
```

**理由**：
- 集中化管理 API，URL 变更只需修改一处
- alova hooks 统一状态管理，消除组件中手写 loading/error 的样板代码
- 按业务域分类，新增 API 时明确归属，避免单个文件膨胀

### 6.3 Overlay 系统

**现状**：Vue 自定义 Overlay 系统，命令式调用 `openDialog()` / `openContextMenu()`，统一走 OverlayHost 渲染。

**迁移后**：
- 复用命令式调用设计，保持相同的开发体验
- React Portal 替代 Vue Teleport
- Zustand Store 替代 Vue Provide/Inject
- `useDialog()` / `useContextMenu()` 替代 `defineDialog()` / `defineContextMenu()`

**目录结构**：
```
app/overlays/
  dialogs/              # Dialog 组件
  context-menus/        # ContextMenu 组件
  host/                 # OverlayHost 渲染宿主 + Zustand Store
  services/             # openDialog / openContextMenu 服务
  hooks/                # useDialog / useContextMenu
  types/                # 类型定义
```

**调用方式（与 Vue 一致）**：
```ts
import { openDialog } from '@/overlays'
import MyDialog from '@/overlays/dialogs/MyDialog'

openDialog(MyDialog, {
  title: '标题',
  onConfirm: async () => { await save() },
})
```

**理由**：
- 保持 Vue 和 React 项目一致的弹窗管理心智模型
- 命令式调用比声明式更适合业务场景
- 统一管理便于全局控制（关闭所有、层级、动画）

### 6.4 路由守卫映射

| Vue Router | TanStack Router |
|------------|-----------------|
| `router.beforeEach` | `beforeLoad`（路由级） |
| `route.meta.requiresAuth` | `beforeLoad` 中检查 `context.user` |
| `onBeforeRouteLeave` | `Blocker` API 或自定义 hook |
| `router-view` | `<Outlet />` |

### 6.5 状态管理映射

| Pinia | Zustand |
|-------|---------|
| `defineStore('auth', () => {...})` | `create<AuthStore>((set, get) => ({...}))` |
| `ref` / `computed` | 直接赋值 / 派生 selector |
| `storeToRefs` | 使用 selector 函数订阅特定状态 |
| HMR (`acceptHMRUpdate`) | `vite-plugin-zustand` 或手动处理 |

### 6.6 前后端类型共享

**现状**：后端 Zod DTO 与前端 `types/` 手工同步，字段变更时编译不报错，运行时才发现。

**迁移后**：创建 `packages/data/` 共享包，Zod schema 作为唯一真相源（Single Source of Truth），前后端共同引用。

**设计**：

```
packages/data/src/
  schemas/           # Zod schema 定义
    auth.schema.ts   #   loginRequestSchema, loginResponseSchema, ...
    kb.schema.ts     #   createKbSchema, kbListSchema, ...
    chat.schema.ts   #   sendMessageSchema, ...
    common.schema.ts #   paginationSchema, apiResponseSchema, ...
  types/
    index.ts         #   type LoginDTO = z.infer<typeof loginSchema>
                     #   所有 TS 类型统一从这里导出
```

**使用方式**：

```typescript
// 后端：替换内联 Zod DTO
import { loginRequestSchema } from '@goferbot/data'
@Post('login')
async login(@Body(ZodValidationPipe(loginRequestSchema)) dto: LoginRequest) { ... }

// 前端：直接引用共享类型
import type { LoginRequest, LoginResponse } from '@goferbot/data'
export const login = (data: LoginRequest) =>
  api.Post<LoginResponse>('/api/auth/login', data)
```

**迁移策略**：
- 阶段二：创建 `packages/data/`，先把 auth 域 Schema 提过去，验证前后端链路
- 阶段三：每迁移一个业务页面时，顺带将对应域的 Schema 迁移到共享包
- 存量后端：暂时不动已有 DTO，新接口强制走共享包

**理由**：
- 单源真相，字段变更时编译报错而非运行时才发现
- Zod 天然支持 `z.infer` 生成 TS 类型，无需额外代码生成工具
- 不引入 OpenAPI / tRPC 等重量级依赖，改动最小

### 6.7 alova 测试策略

**核心原则**：分层测试。单元测试 mock hook 返回值，集成测试用 Mock 适配器测完整链路。

| 层级 | 测什么 | alova 处理方式 |
|------|--------|----------------|
| 单元测试 | 组件渲染逻辑：loading/data/error 各状态展示、用户交互回调 | `vi.mock('alova/client')`，返回可控的 hook 返回值 |
| 集成测试 | 组件 + alova 完整生命周期：请求→响应→状态切换→缓存命中→错误重试 | 创建测试用 alova 实例，挂 Mock 请求适配器 |

**单元测试示例**：

```typescript
import { useRequest } from 'alova/client'

vi.mock('alova/client', () => ({ useRequest: vi.fn() }))

it('loading 态', () => {
  vi.mocked(useRequest).mockReturnValue({ data: undefined, loading: true, error: undefined, send: vi.fn() } as any)
  // 断言：骨架屏/stale-loader 渲染
})

it('error 态', () => {
  vi.mocked(useRequest).mockReturnValue({ data: undefined, loading: false, error: new Error('失败'), send: vi.fn() } as any)
  // 断言：错误信息渲染 + 重试按钮
})
```

**重点测试场景**：

| 场景 | 优先级 | 关键断言 |
|------|--------|----------|
| loading → data 状态流转 | P0 | 每个页面的基础渲染分支 |
| error + send() 重试 | P0 | 错误提示 + 点击重试后 loading 恢复 |
| useWatcher 防抖（debounce: 500） | P1 | vi.advanceTimers 验证延迟行为 |
| useFetcher 手动 fetch() | P1 | 点击按钮后 data 更新 |
| usePagination 翻页联动 | P1 | page/data/total/isLastPage 同步 |
| 缓存命中（fromCache） | P2 | 二次请求不触发网络 |
| Token 刷新 401 重放 | P1 | Mock 401→refresh→重试→成功 链路 |

**理由**：
- 单元测试不依赖 alova 真实逻辑，快速、稳定、聚焦组件行为
- 集成测试覆盖 alova 核心链路（状态流转/缓存/错误），数量少但关键
- 两个层级互补，避免"浅测覆盖不全、深测维护成本高"的两难

---

## 7. 风险与应对

| 风险 | 影响 | 概率 | 应对策略 |
|------|------|------|----------|
| TanStack Start 生态资料少 | 遇到问题难以搜索 | 中 | 优先使用稳定功能（路由、serverFn），避免实验特性；保留 Vue 代码作为参考 |
| shadcn/ui 组件 API 差异 | 组件行为不一致 | 高 | 逐个验证，建立内部组件对照表 |
| 迁移周期过长影响业务 | 新功能无法并行开发 | 中 | 采用并行策略：新功能在 Vue 端开发，迁移按页面逐个替换 |
| 测试覆盖率下降 | 回归风险 | 中 | 每迁移一个页面同步迁移对应测试，不累积技术债 |
| 团队 React 经验不足 | 开发效率低 | 低 | 优先迁移简单页面（login/register）作为学习样本 |
| BlockNote 集成复杂度 | 富文本编辑器引入后问题多 | 中 | 在 ChatView 迁移完成后单独评估，不阻塞整体迁移 |
| alova 与后端响应格式兼容 | `responded.onSuccess` 需对齐 NestJS 统一 `{ data: T }` 包装 | 低 | 在 `utils/server.ts` 中统一处理，编写后在 auth 接口上先行验证 |
| alova SSE 支持度 | Chat 页面依赖 SSE 流式响应 | 低 | alova 提供 `useSSE` hook，迁移 ChatView 时优先验证 |

---

## 8. 成功标准

### 8.1 功能标准

- [ ] 登录/注册流程正常
- [ ] 鉴态状态持久化（刷新不丢失）
- [ ] Chat 页面完整可用（消息发送、接收、历史记录）
- [ ] KnowledgeBase 文档管理可用
- [ ] Settings 配置保存与提示
- [ ] 路由守卫正确拦截未认证用户

### 8.2 技术标准

- [ ] `pnpm dev:web` 正常启动，代理到后端
- [ ] `pnpm build` 产物无错误
- [ ] `pnpm test` 单元测试通过
- [ ] `pnpm test:e2e` 核心流程通过
- [ ] `pnpm type-check` 无类型错误
- [ ] 删除 `packages/webui` 后不影响其他包

### 8.3 性能标准

- [ ] 首屏加载时间 ≤ 现有 Vue 版本
- [ ] 构建产物体积 ≤ 现有版本 + 10%

---

## 9. 附录

### 9.1 命名规范

| 包名 | 目录 | 说明 |
|------|------|------|
| `@goferbot/web` | `packages/web` | 用户端前端 |
| `@goferbot/admin` | `packages/admin` | 后台管理端 |
| `@goferbot/server` | `packages/server` | NestJS API |
| `@goferbot/rag-sdk` | `packages/rag-sdk` | RAG 工具库 |
| `@goferbot/data` | `packages/data` | 前后端共享 Schema 与类型 |

### 9.2 脚本映射

| 现有脚本 | 迁移后 |
|----------|--------|
| `pnpm dev:web` | `pnpm --filter @goferbot/web dev` |
| `pnpm dev:server` | `pnpm --filter @goferbot/server dev` |
| `pnpm dev` | `concurrently "pnpm dev:server" "pnpm dev:web"` |
| `pnpm build` | `pnpm -r build` |

### 9.3 参考资源

- [TanStack Start 官方文档](https://tanstack.com/start/latest)
- [TanStack Router 文档](https://tanstack.com/router/latest)
- [shadcn/ui 文档](https://ui.shadcn.com)
- [Zustand 文档](https://docs.pmnd.rs/zustand)
- [Alova 官方文档](https://alovajs.dev)
- [Alova React 使用参考](../reference/alova-react-guide.md)

---

**状态**：Draft  
**创建日期**：2026-06-05  
**作者**：GoferBot 团队  
**评审人**：待填写
