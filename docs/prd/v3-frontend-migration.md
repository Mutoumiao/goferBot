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

采用 `apps/` + `packages/` 分层，符合 Monorepo 最佳实践：

```
knowledge-base/
├── apps/
│   ├── web/                    # 用户端前端（本次迁移目标）
│   │   ├── app/                # TanStack Start 路由目录
│   │   │   ├── routes/         # 页面路由
│   │   │   ├── overlays/       # 弹窗系统（Dialog / ContextMenu）
│   │   │   │   ├── dialogs/    # Dialog 组件
│   │   │   │   ├── context-menus/  # ContextMenu 组件
│   │   │   │   ├── host/       # OverlayHost 渲染宿主
│   │   │   │   ├── services/   # openDialog / openContextMenu 服务
│   │   │   │   ├── hooks/      # useDialog / useContextMenu
│   │   │   │   └── types/      # 类型定义
│   │   │   ├── components/     # 业务组件
│   │   │   ├── lib/            # 工具函数
│   │   │   ├── utils/          # 共享工具
│   │   │   └── styles/         # 全局样式
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   └── tsconfig.json
│   └── admin/                  # 后台管理端（未来建设）
│       ├── src/
│       ├── package.json
│       └── vite.config.ts
├── packages/
│   ├── server/                 # NestJS API（保持现状）
│   └── rag-sdk/                # RAG 工具库（保持现状）
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/
└── package.json                # workspace root
```

### 2.2 决策依据

| 考量维度 | 选择 | 理由 |
|----------|------|------|
| 前端框架 | TanStack Start | 保留 Vite 生态、路由守卫接近 Vue Router、支持 shadcn/ui |
| UI 库（用户端） | shadcn/ui | 与 Tailwind 深度集成、组件可定制、社区活跃 |
| UI 库（管理端） | Ant Design Pro | B 端组件成熟度高、ProComponents 节省开发成本 |
| 状态管理 | Zustand | 轻量、TypeScript 友好、Pinia 用户学习成本低 |
| 构建工具 | Vite | 复用现有配置、TanStack Start 原生支持 |
| Monorepo 结构 | apps/ + packages/ | 语义清晰（apps=可部署应用，packages=共享库）、符合行业惯例 |

### 2.3 不采用的方案

| 方案 | 放弃原因 |
|------|----------|
| Next.js | 需放弃 Vite 配置、App Router 与 Vue Router 概念差异大、SSR 非必需 |
| 在 Vue 中嵌入 React | 短期可行但技术债累积，无法支持后续 React 生态扩展 |
| 根目录 `app/` | 破坏 Monorepo 一致性、与 Next.js 路由目录命名冲突、多应用时层级混乱 |
| 全放 `packages/` | `packages` 语义为共享库，与应用混放层级不清晰 |

---

## 3. 技术栈

### 3.1 用户端（apps/web）

| 层级 | 技术 | 版本 |
|------|------|------|
| 框架 | TanStack Start | latest |
| 路由 | TanStack Router | latest |
| UI 组件 | shadcn/ui | latest |
| 样式 | Tailwind CSS v4 | ^4.1.18 |
| 状态管理 | Zustand | latest |
| 数据获取 | TanStack Query | ^5.0.0 |
| 图标 | lucide-react | latest |
| 构建 | Vite | ^7.0.0 |
| 测试 | Vitest + React Testing Library | latest |

### 3.2 管理端（apps/admin）——预留

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
| `api/client.ts` | 拷贝后调整 import，纯 TS 逻辑不变 |
| `types/index.ts` | 直接拷贝 |
| `lib/utils.ts`（`cn` 函数） | 直接拷贝 |
| `utils/markdown.ts` | 直接拷贝 |
| Tailwind 主题变量 | 复制到 `apps/web/app/globals.css` |
| 业务逻辑（数据处理） | 提取到独立 `.ts` 文件后复用 |

### 4.3 必须重写的部分

| 模块 | 工作量 | 复杂度 |
|------|--------|--------|
| Vue SFC → TSX | 2-3 周 | 中 |
| shadcn-vue → shadcn/ui | 1-1.5 周 | 低（体力活） |
| Pinia → Zustand | 2 天 | 低 |
| Vue Router → TanStack Router | 2-3 天 | 中 |
| Overlay 系统（Teleport → Portal） | 2-3 天 | 中 |
| 测试（Vue Test Utils → RTL） | 2-3 天 | 低 |

---

## 5. 迁移计划

### 5.1 阶段一：基建搭建（第 1 周）

**目标**：建立新项目骨架，验证构建链路

| 任务 | 详情 |
|------|------|
| 创建目录结构 | `apps/web/`、`apps/admin/`（空壳） |
| 初始化 TanStack Start | `npm create @tanstack/start@latest --tailwind --add-ons shadcn` |
| 配置 Vite | 复用代理规则（`/api` → `localhost:3000`）、路径别名（`@/`）、Tailwind 4 |
| 配置 pnpm workspace | 更新 `pnpm-workspace.yaml` 包含 `apps/*` |
| 安装依赖 | Zustand、TanStack Query、lucide-react |
| 验证构建 | `pnpm dev:web` 能正常启动并代理到后端 |

**产出**：`apps/web` 可运行，显示默认首页

### 5.2 阶段二：核心能力迁移（第 2-3 周）

**目标**：迁移鉴权、布局、核心页面

| 任务 | 详情 |
|------|------|
| 迁移 `lib/utils.ts` | `cn` 函数、类型工具 |
| 迁移 `types/` | 全局类型定义 |
| 迁移 `api/client.ts` | HTTP 客户端（fetch + SSE + token 刷新） |
| 搭建 Zustand Store | auth Store（登录状态、token 管理） |
| 创建根路由 `__root.tsx` | 全局布局、Head 配置 |
| 创建 `/login` 页面 | 登录表单（无鉴权，最简单） |
| 创建 `/register` 页面 | 注册表单 |
| 创建 `/app` 布局路由 | AuthenticatedLayout（Sidebar + TabBar） |
| 实现路由守卫 | `beforeLoad` 中检查鉴权状态 |
| 迁移 Overlay 系统 | React Portal + Zustand 替代 Teleport，复用命令式调用设计 |

**产出**：登录/注册/布局可正常工作，鉴权流程打通

### 5.3 阶段三：功能页面迁移（第 4-5 周）

**目标**：逐个迁移业务页面

| 优先级 | 页面 | 说明 |
|--------|------|------|
| P0 | ChatView | 最复杂页面，优先处理 |
| P1 | KnowledgeBasePage | 文档管理 |
| P1 | HistoryPage | 历史记录 |
| P2 | SettingsPage | 设置（含未保存提示） |
| P2 | RecycleBinPage | 回收站 |

**策略**：
- 每个页面迁移时同步替换涉及的 shadcn-vue 组件
- 先保证功能可用，再细化样式对齐
- 每完成一个页面，在本地验证与后端的接口连通性

### 5.4 阶段四：UI 组件库收尾（第 6 周）

**目标**：替换剩余 shadcn-vue 组件，统一样式

| 任务 | 详情 |
|------|------|
| 梳理未替换组件 | 对比 `components/ui/` 目录 |
| 批量替换 | 使用 shadcn/ui CLI 安装对应组件 |
| 样式对齐 | 检查 `:deep()` 样式穿透的替代方案 |
| 主题验证 | 确认 Tailwind 变量与现有设计一致 |

### 5.5 阶段五：测试与打磨（第 7 周）

| 任务 | 详情 |
|------|------|
| 单元测试迁移 | Vue Test Utils → React Testing Library |
| E2E 测试适配 | Playwright 脚本更新（选择器从 Vue 改为 React） |
| 类型检查 | `pnpm type-check` 全量通过 |
| 构建验证 | `pnpm build` 产物正常 |
| 删除旧代码 | 移除 `packages/webui` |
| 更新文档 | README、开发脚本、环境变量说明 |

---

## 6. 关键设计决策

### 6.1 鉴权方案

**现状**：JWT + localStorage，Pinia Store 管理

**迁移后**：
- 第一阶段：保持 JWT + localStorage，用 Zustand 替代 Pinia
- 第二阶段（可选）：迁移至 cookie + `createServerFn`，支持 SSR 鉴权

**理由**：
- 保持现状可降低迁移风险
- 后续如需 SSR，再逐步迁移到服务端 session

### 6.2 数据获取

**现状**：`api/client.ts` 纯客户端 fetch

**迁移后**：
- 保留 `api/client.ts` 作为底层 HTTP 客户端
- 上层用 TanStack Query 管理缓存、重试、状态
- 后续新接口可逐步采用 `createServerFn`

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
| `@goferbot/web` | `apps/web` | 用户端前端 |
| `@goferbot/admin` | `apps/admin` | 后台管理端 |
| `@goferbot/server` | `packages/server` | NestJS API |
| `@goferbot/rag-sdk` | `packages/rag-sdk` | RAG 工具库 |

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

---

**状态**：Draft  
**创建日期**：2026-06-05  
**作者**：GoferBot 团队  
**评审人**：待填写
