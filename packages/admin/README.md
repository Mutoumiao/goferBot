# GoferBot Admin

Admin management console for the GoferBot platform. 基于 **React 19 + TanStack Start + Ant Design v5 + alova + Zustand + Tailwind CSS v4** 构建。

本文档面向新接手的开发者，帮助快速理解项目的功能边界、分层结构、模块职责与开发约定。

---

## 1. 快速开始

```bash
# 安装依赖（根目录）
pnpm install

# 启动 admin（端口 1421）
pnpm --filter @goferbot/admin dev

# 类型检查
pnpm --filter @goferbot/admin type-check

# 单元测试
pnpm --filter @goferbot/admin test

# 带覆盖率运行测试
cd packages/admin && npx vitest run --coverage
```

默认访问地址：`http://localhost:1421`。

### 控制台（Dashboard）说明

- **定位**：系统健康 + RAG/Companion 黄金指标观测枢纽，不是经营增长/假环比看板。
- **API**：`GET /admin/dashboard/summary`（`dashboard:read`）；详页 `GET /admin/observability/rag|companion`（`system:metrics`）。
- **禁止生产 mock**：接口失败时展示错误态，**不会**静默用虚构业务统计顶替。
- **开发 fixture**：仅当显式设置 `VITE_USE_DASHBOARD_MOCK=1` 时启用本地 mock。
- **详页入口**：一期不在主导航挂观测菜单；从 Hub 卡片「查看详情」进入（需 `system:metrics`）。

---

## 2. 技术栈

| 分类 | 技术 | 说明 |
| :--- | :--- | :--- |
| 框架 | React 19 + TanStack Start | SPA 模式，文件路由 |
| UI | Ant Design v5 + @ant-design/pro-components | ProLayout / ProTable / ProForm |
| 请求 | alova v3（fetch 适配器） | 带统一拦截、token 刷新、共享请求 |
| 状态 | Zustand + persist | Auth / Settings 持久化 |
| 样式 | Tailwind CSS v4 + `@tailwindcss/vite` | 与 antd Token 共存 |
| 工具 | ahooks, lucide-react, sonner | 常用 Hook、图标、Toast |
| 测试 | Vitest + Testing Library | 单测 + 覆盖率门禁 |

---

## 3. 目录结构

```
packages/admin/
├── src/
│   ├── api/                 # alova method 定义层（只定义，不 send）
│   │   ├── admin.ts         #   用户管理（CRUD / 启禁用 / 重置密码 / 分配角色）
│   │   ├── audit.ts         #   审计日志查询 / 导出
│   │   ├── auth.ts          #   登录 / 登出 / 刷新 / 当前用户 / 改密 / 二次校验
│   │   ├── dashboard.ts     #   Hub summary + observability 详页 API
│   │   ├── model.ts         #   模型设置 CRUD + 测试连接
│   │   ├── rag.ts           #   RAG 任务队列（若仍使用）
│   │   ├── role.ts          #   角色 CRUD + 权限点
│   │   └── session.ts       #   会话 / 消息流
│   ├── features/            # 业务模块（按 feature 分层）
│   │   ├── dashboard/       #   观测枢纽 Hub（健康 + RAG/Companion KPI）
│   │   ├── observability/   #   RAG / Companion 二级观测详页
│   │   ├── <feature>/
│   │   │   ├── services.ts  #   唯一业务入口，调 api + 错误映射 + toast
│   │   │   ├── services.spec.ts
│   │   │   └── components/  #   本 feature 专属 UI 组件
│   ├── components/
│   │   ├── common/          # 通用组件（PageHeader / StatusTag / EmptyState 等）
│   │   └── layout/           # AdminLayout / MenuConfig
│   ├── routes/              # 文件路由（仅组合，不写业务）
│   ├── stores/              # zustand：auth / settings
│   ├── utils/               # server.ts / auth-token / auth-guard / error-mapper / confirm-action
│   ├── hooks/               # useQueryWithRetry
│   ├── lib/utils.ts         # clsx / cn 工具
│   ├── router-register.ts  # 路由元数据（标题 / 图标 / nav 开关）
│   └── router.tsx           # TanStack Router 入口
```

### 分层依赖（单向）

```
routes  →  features/components  →  features/services  →  api  →  alovaInstance (utils/server.ts)
```

- **禁止反向引用**：`api/` 不得调用 `services/`，`routes/` 不得直接调 `api/`。
- **`api/` 层不得 `.send()`**：发送请求一律在 `services.ts` 中统一处理，便于 mock 与错误处理。

---

## 4. 路由与菜单

路由由 TanStack Start 文件路由生成，元数据集中在 [router-register.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/router-register.ts)。

| 路由 | 标题 | 角色 | 说明 |
| :--- | :--- | :--- | :--- |
| `/login` | 登录 | 公共 | 管理员邮箱 + 密码登录 |
| `/dashboard` | 控制台 | `dashboard:read` | 依赖健康 + RAG/Companion 黄金 KPI（观测 Hub） |
| `/observability/rag` | RAG 观测 | `system:metrics` | 非主导航；Hub 直链，索引/检索/依赖分块 |
| `/observability/companion` | Companion 观测 | `system:metrics` | 非主导航；延迟/情绪/成本安全分块 |
| `/users` | 用户管理 | ADMIN | 列表 / 搜索 / 启禁用 / 批量 / 详情 |
| `/users/$id` | 用户详情 | ADMIN | 编辑 / 重置密码 / 分配角色 |
| `/roles` | 权限管理 | ADMIN | 角色列表 / 权限矩阵 |
| `/roles/$id` | 角色详情 | ADMIN | 编辑角色 / 绑定权限 |
| `/model-providers` | 模型提供商 | ADMIN | Provider/Model/Endpoint 管理 |
| `/module-settings` | 模块配置 | ADMIN | Chat/RAG/Companion 模型选择 |
| `/companions` | 内置伴侣 | `companions:read` | 系统内置伴侣管理 |
| `/audit` | 审计日志 | ADMIN | 管理员操作记录 |
| `/profile` | 个人中心 | ADMIN/USER | 修改密码 / 登录历史 |

菜单由 [MenuConfig.tsx](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/components/layout/MenuConfig.tsx) 中的 `useMenuConfig` 基于 `useAuthStore.user.role` 裁剪：

```
ADMIN   → 全量菜单
USER    → dashboard + profile（仅基础能力）
```

---

## 5. 业务模块速查

### Auth（登录与鉴权）
- 服务：[auth/services.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/features/auth/services.ts)
- 组件：[LoginForm.tsx](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/features/auth/components/LoginForm.tsx)
- 职责：
  - `loginService`：校验邮箱密码，换取 token 并写入 store
  - `refreshAuth`：用 refresh token 静默续期
  - `fetchCurrentUser`：拉取当前用户（401/403 时清空 auth）
  - `logoutService`：清空 token 与 store，跳转登录
- 状态存储：[stores/auth.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/stores/auth.ts)（zustand persist，命名空间 `goferbot-admin-auth`）

### Dashboard（控制台 / 观测 Hub）
- 服务：[dashboard/services.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/features/dashboard/services.ts)
- API：`GET /admin/dashboard/summary?window=`（`dashboard:read`）
- 特点：**禁止生产静默 mock**；失败展示错误态。仅 `VITE_USE_DASHBOARD_MOCK=1` 允许开发 fixture。
- 组件拆分：
  - `HealthBar`：依赖健康（postgres/redis/minio/knowledge-ai）合成 ok/degraded/down
  - `KpiCard`：KPI 三态（ready / pending_instrumentation / insufficient_samples）+ partial
  - `InventoryStrip`：规模弱化展示（用户/KB/文档/伴侣计数）
  - `DashboardView`：时间窗 + 刷新 + RAG/Companion 黄金指标 + 详情入口

### Observability（二级详页）
- 服务：[observability/services.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/features/observability/services.ts)
- API：`GET /admin/observability/rag|companion`（`system:metrics`）
- 组件：`ObservabilityDetailView`（顶栏 KPI + sections 分块）
- 路由：`/observability/rag`、`/observability/companion`（`nav: false`，Hub 卡片直链；无 metrics 权限隐藏入口并由路由守卫拦截）

### Users（用户管理）
- 服务：[users/services.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/features/users/services.ts)
- 组件：`UserTable`（列表 + 搜索 + 批量启禁用/删除）、`UserCreateForm`、`UserEditForm`、`ResetPasswordDialog`、`RoleAssignDialog`
- 并发控制：编辑时带 `updatedAt` 版本号，409 返回 `CONFLICT` 提示
- 二次确认：删除 / 重置密码 / 分配角色触发密码校验

### Roles（权限管理）
- 服务：[roles/services.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/features/roles/services.ts)
- 组件：`RoleList`、`RoleForm`（create/edit 双模式）、`PermissionMatrix`
- 特点：**完全真实 API**，不再回退 mock。权限拉取失败直接 toast 提示。

### Models（模型设置）
- 组件：`ModelList`、`ModelConfigForm`、`TestConnectionDrawer`
- 能力：Provider/Model/Endpoint 管理、API Key 掩码（`sk-****xxxx`）、测试连接、启停。

### Audit（审计日志）
- 服务：[audit/services.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/features/audit/services.ts)
- 组件：`AuditLogTable`
- 能力：查询 + CSV 导出。

### Profile（个人中心）
- 服务：[profile/services.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/features/profile/services.ts)
- 组件：`ProfilePage`、`PasswordChangeForm`、`LoginHistoryList`、`BasicInfoCard`
- 能力：修改密码、查看登录历史。

---

## 6. 核心工具与约定

### 统一请求实例 — `utils/server.ts`
- 基于 `alova` 创建，拦截器负责：
  - 自动附加 `Authorization: Bearer <token>`
  - 401/403 时自动走 refresh + retry，并发请求复用一次刷新
  - 非 2xx 响应解析 `{ code, message }` 并抛出带 `status/code` 的 Error
- 上层 services 只需 `alovaInstance.Get<T>(url).send()`。

### 错误映射 — `utils/error-mapper.ts`
- `mapErrorMessage(err)` 把后端错误码（`AUTH_FAIL` / `CONFLICT` / `FORBIDDEN` …）统一转为中文提示。
- 禁止 UI 层自行拼错误文案，全部走此函数。

### 守卫与 Hydration — `utils/auth-guard.ts`
- `waitForAuthInit(maxMs = 3000)`：等待 zustand persist hydration 完成，避免首屏误判未登录。
- `isAdmin(snapshot)`：基于 token + role 的纯函数判断，供路由守卫复用。

### 带重试的数据查询 — `hooks/useQueryWithRetry.ts`
- 提供 `{ data, loading, error, run, reset }` 统一三态。
- Dashboard、Models、Sessions 等页面已全部使用此 Hook，避免各组件重复造轮子。

### 二次确认 — `utils/confirm-action.tsx`
- `confirmPasswordAction`：敏感操作（删除 / 权限变更 / 角色分配）弹出密码校验框，对接后端 `POST /auth/verify-password`。

---

## 7. 测试与覆盖率

- 测试框架：Vitest + Testing Library
- 测试文件：`src/**/*.spec.ts(x)`
- 覆盖率门槛（vitest.config.ts）：

| 指标 | 门槛 |
| :--- | :--- |
| Statements | ≥ 60% |
| Branches | ≥ 50% |
| Functions | ≥ 60% |
| Lines | ≥ 60% |

覆盖率仅针对核心逻辑层（services / hooks / utils / stores / MenuConfig），UI 组件暂不纳入门槛以避免噪声。

当前状态：

```
Statements   81.76%
Branches     74.76%
Functions    91.78%
Lines        82.45%
```

---

## 8. 常见开发流程

### 新增一个业务模块
1. 在 `src/api/` 下新建 `<name>.ts`，只定义 alova method，不调用 `.send()`
2. 在 `src/features/<name>/` 下新建 `services.ts`，统一处理请求、错误映射、toast
3. 在 `src/features/<name>/components/` 下拆 UI 组件，单文件 ≤ 300 行
4. 在 `src/routes/_authenticated/` 下新建路由文件，仅组合 `services` + `components`
5. 在 `src/router-register.ts` 注册元数据（title / icon / nav）
6. 如需进入左侧菜单，在 `MenuConfig.tsx` 的 `ALLOWED_MENU_BY_ROLE` 增加 key
7. 新建 `services.spec.ts` 走查覆盖

### 调用后端真实接口
- 已就绪：`/auth/*`、`/admin/users/*`、`/admin/roles*`、`/admin/permissions`、`/admin/audit`、`GET /admin/dashboard/summary`、`GET /admin/observability/rag|companion`
- 未纳入本 change：会话回放列表等（`/admin/sessions*` 如仍有前端 stub，不在观测 Hub 范围）

### 安全红线
- 敏感操作必须走 `confirmPasswordAction`
- Token 存储使用独立命名空间，与 web 端隔离
- 错误提示不得暴露具体字段（统一 "账号或密码错误"）
- 观测详页需 `system:metrics`；生产路径禁止用 mock 顶替真实 KPI

---

## 9. 后续 Roadmap（P3）

1. **观测深化**：Companion retrieval 埋点、token 成本、Chat latencyMs 可选写入；metadata 扫描改为 DB 聚合/物化
2. **审计写入闭环**：在关键 service 成功后触发 `POST /admin/audit`
3. **国际化**：`error-mapper` 扩展多语言资源
4. **覆盖率继续上探**：逐步把 UI 组件纳入覆盖率统计
