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
│   │   ├── dashboard.ts     #   Dashboard 聚合数据
│   │   ├── model.ts         #   模型设置 CRUD + 测试连接
│   │   ├── rag.ts           #   RAG 任务队列
│   │   ├── role.ts          #   角色 CRUD + 权限点
│   │   └── session.ts       #   会话 / 消息流
│   ├── features/            # 业务模块（按 feature 分层）
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
| `/dashboard` | 控制台 | ADMIN/USER | 统计卡片、最近活动、系统健康 |
| `/users` | 用户管理 | ADMIN | 列表 / 搜索 / 启禁用 / 批量 / 详情 |
| `/users/$id` | 用户详情 | ADMIN | 编辑 / 重置密码 / 分配角色 |
| `/roles` | 权限管理 | ADMIN | 角色列表 / 权限矩阵 |
| `/roles/$id` | 角色详情 | ADMIN | 编辑角色 / 绑定权限 |
| `/rag-observability` | RAG 观测 | ADMIN | 任务队列状态 / 失败明细 |
| `/sessions` | 会话观测 | ADMIN | 会话列表 / 脱敏展示 |
| `/sessions/$id` | 会话详情 | ADMIN | 消息流 / 检索片段 |
| `/model-providers` | 模型提供商 | ADMIN | Provider/Model/Endpoint 管理 |
| `/module-settings` | 模块配置 | ADMIN | Chat/RAG/Companion 模型选择 |
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

### Dashboard（控制台）
- 服务：[dashboard/services.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/features/dashboard/services.ts)
- 特点：**真实 API 优先 + mock 回退**。后端不可达时回退到本地 Mock，便于开发演示。
- 组件拆分：
  - `StatCards`：4 张指标卡（用户数 / 会话数 / 文档数 / RAG 任务数）
  - `RecentActivities`：最近活动列表
  - `SystemHealth`：CPU / 内存 / 磁盘 / 队列状态
  - `OverviewChart`：RAG 任务状态分布图
  - `DashboardView`：整体容器（含错误重试 UI）

### Users（用户管理）
- 服务：[users/services.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/features/users/services.ts)
- 组件：`UserTable`（列表 + 搜索 + 批量启禁用/删除）、`UserCreateForm`、`UserEditForm`、`ResetPasswordDialog`、`RoleAssignDialog`
- 并发控制：编辑时带 `updatedAt` 版本号，409 返回 `CONFLICT` 提示
- 二次确认：删除 / 重置密码 / 分配角色触发密码校验

### Roles（权限管理）
- 服务：[roles/services.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/features/roles/services.ts)
- 组件：`RoleList`、`RoleForm`（create/edit 双模式）、`PermissionMatrix`
- 特点：**完全真实 API**，不再回退 mock。权限拉取失败直接 toast 提示。

### RAG Observability（RAG 观测）
- 服务：[rag-observability/services.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/features/rag-observability/services.ts)
- 组件：`RAGStatusBoard`
- 特点：当前以 Mock 数据为主，接口层已抽象，待后端就绪后无感切换。

### Sessions（会话观测）
- 服务：[sessions/services.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/admin/src/features/sessions/services.ts)
- 组件：`SessionList`、`SessionDetail`、`MessageStream`
- 特点：默认脱敏展示（IP / 邮箱 / 手机号），由后端下发脱敏规则。

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
- 已就绪接口：`/auth/*`、`/admin/users/*`、`/admin/dashboard`、`/admin/roles*`、`/admin/permissions`
- 待后端补齐：`/admin/rag/tasks`、`/admin/sessions*`、`/admin/audit`

### 安全红线
- 敏感操作必须走 `confirmPasswordAction`
- 会话详情默认脱敏，管理员查看行为写入审计日志
- Token 存储使用独立命名空间，与 web 端隔离
- 错误提示不得暴露具体字段（统一 "账号或密码错误"）

---

## 9. 后续 Roadmap（P3）

1. **真实接口全量替换**：RAG / Sessions / Audit 从 Mock 切换为真实 API
2. **审计写入闭环**：在关键 service 成功后触发 `POST /admin/audit`
3. **国际化**：`error-mapper` 扩展多语言资源
4. **覆盖率继续上探**：逐步把 UI 组件纳入覆盖率统计
