# 管理后台 — 用户管理 API 与基础设施规范化

> 版本：v1.0
> 日期：2026-06-03
> 状态：已批准

---

## 1. 背景与目标

当前系统存在以下问题：
1. **缺乏系统级用户管理能力**：测试期间的数据清理、用户账号管控等操作无法通过 API 完成，需要直接操作数据库
2. **无统一分页封装**：后端 `list` 接口均为全量查询，随着数据增长性能会下降
3. **Session 列表接口前后端不一致**：前端期望 `{ items: Session[] }` 格式，但后端直接返回数组，导致 `items` 为 `undefined`

**目标**：
- 提供 Prisma 统一分页封装，规范后续所有列表接口
- 修复 Session 列表接口格式问题并引入分页
- 提供最小可用的 Admin API（用户列表 + 状态管理），使管理员能够通过 Postman 操作
- 建立基于角色的权限控制基础（RBAC）

**非目标**：
- 管理后台前端界面（后续批次考虑）
- 系统监控、错误收集、反馈处理（后续批次考虑）
- 用户数据内容管理（知识库、文档、会话等属于用户隐私，后台不应浏览）
- 知识库/文件夹/文档列表的分页（当前前端需要全量数据做排序和树形展示，暂不动）

---

## 2. 功能批次

| 批次 | 功能 | 优先级 | 状态 |
|------|------|--------|------|
| 01 | Prisma 分页封装 + Session 接口修复 + 用户管理 API + RBAC 权限 | P0 | 待启动 |
| 02 | 知识库/文档/文件夹列表分页（当前端支持时） | P1 | 待规划 |
| 03 | 系统监控与反馈处理 | P1 | 待规划 |
| 04 | 管理后台前端界面 | P2 | 待规划 |

---

## 3. 批次 01 功能清单

### 3.1 Prisma Client 扩展 — 统一分页封装

参考模板项目 `nest-http-prisma-zod` 的实现，为当前项目的 `PrismaService` 扩展以下能力：

- **`$allModels.paginate()`**：通用分页查询方法
  - 参数：查询条件（`where` / `select` / `include` / `orderBy`）+ 分页选项（`page` / `size`）
  - 返回：`{ data: T[], pagination: { total, size, totalPage, currentPage, hasNextPage, hasPrevPage } }`
- **`$allModels.exists()`**：快速判断记录是否存在
  - 参数：`where` 条件
  - 返回：`boolean`

**分页 DTO**：
- `PagerDto`：基础分页参数（`page` 默认 1，`size` 默认 10，最大 50）
- 支持扩展（如 `WithSearchPagerDto` 增加 `search` 字段）

### 3.2 Session 列表接口修复与分页

**问题**：前端 `session.ts` 第 47 行按 `{ items: Session[] }` 解析，但后端 `session.service.ts` 直接返回数组。

**修复内容**：
- 后端 `SessionService.list` 改为返回 `{ items: Session[], pagination: Paginator }`
- 支持 `page` / `limit` 查询参数（默认 `page=1, limit=50`）
- 使用新封装的 `paginate()` 方法
- 前端无需改动（已按 `{ items }` 解析）

### 3.3 统一账号 + Role 字段

- 在现有 `User` 表增加 `role` 字段（`USER` / `ADMIN`，默认 `USER`）
- 在现有 `User` 表增加 `isActive` 字段（布尔，默认 `true`）
- JWT payload 携带 `role`，用于权限校验

### 3.4 管理员认证与授权

- 新增 `@Roles()` 装饰器 — 标记接口所需角色
- 新增 `RolesGuard` — 校验 JWT 中的 `role` 是否匹配
- Admin API 统一使用 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(Role.ADMIN)`

### 3.5 Admin 用户列表接口

- `GET /admin/users`
- 认证：`ADMIN` 角色
- 支持分页（`page` / `size`）
- 支持按邮箱模糊搜索（`search`）
- 支持按状态过滤（`isActive`）
- 默认按注册时间倒序
- 返回：`{ data: User[], pagination: Paginator }`

### 3.6 Admin 用户状态切换接口

- `PATCH /admin/users/:id/status`
- 认证：`ADMIN` 角色
- 请求体：`{ isActive: boolean }`
- 切换用户禁用/启用状态

### 3.7 登录接口增强

- 登录时校验 `isActive`
- 禁用账号返回 `403 Account disabled`

---

## 4. 现有接口分析

| 接口 | 当前行为 | 本次改动 | 理由 |
|------|----------|----------|------|
`GET /api/knowledge-bases` | 全量返回数组 | ❌ 不动 | 前端需要全量做排序和选择
`GET /api/knowledge-bases/:kbId/folders` | 按 parentId 全量返回 | ❌ 不动 | 树形分级，单层数量可控
`GET /api/knowledge-bases/:kbId/documents` | 按 folderId 全量返回 | ❌ 不动 | 单文件夹内数量可控
`GET /api/sessions` | 全量返回数组（**前后端格式不一致**） | ✅ 改为 `{ items, pagination }` | 修复 bug + 高频资源需要分页
`GET /admin/users` | 不存在 | ✅ 新建，带分页 | Admin 功能需要

---

## 5. 架构决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| 统一账号体系（不分离 Admin 表） | 管理员即普通用户，后续扩展角色（如作者）更自然 | 是，可后续迁移 |
| 仅 `USER` / `ADMIN` 两级角色 | 最小可行，满足当前需求 | 是，可扩展 enum |
| 禁用 = 禁止登录，数据保留 | 避免误操作导致数据丢失，符合隐私保护原则 | 是，可扩展软删除 |
| Admin API 直接注入 PrismaService | 管理逻辑与用户逻辑解耦，避免污染 UserService | 是，可后续抽象 |
| Prisma 扩展使用 `$extends` | 官方推荐方式，类型安全，所有模型自动获得 paginate/exists | 是，可替换为 Repository 模式 |
| Session 分页默认值 `page=1, limit=50` | 前端当前无分页 UI，50 条足够展示，同时避免全量 | 是，可调整 |

---

## 6. 安全考量

- Admin API 暴露的操作具有破坏性（禁用账号），必须严格校验 `ADMIN` 角色
- 初始部署后，需要手动将至少一个现有用户提升为 `ADMIN`
- 后续批次应考虑操作审计日志
- 分页参数必须限制 `size` 最大值（如 50），防止恶意大页请求
