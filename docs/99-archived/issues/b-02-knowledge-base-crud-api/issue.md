---
id: b-02-knowledge-base-crud-api
type: issue
status: closed
track: backend
priority: p0
summary: 实现知识库 CRUD API，包含知识库和虚拟文件夹的增删改查。前端可通过 API 管理知识库和文件夹，数据持久化到 PostgreSQL。
blocked_by: [i-02-drizzle-orm-setup, b-01-auth-api]
blocks: []
spec: docs/03-specs/b-02-knowledge-base-crud-api/
plan: docs/04-plans/b-02-knowledge-base-crud-api/v1.md
tests: docs/08-test-cases/b-02-knowledge-base-crud-api/
token_estimate: 1100
---

状态: needs-triage
分类: enhancement

## 要构建的内容

实现知识库 CRUD API，包含知识库和虚拟文件夹的增删改查。

## 规格引用

- 功能规格: docs/03-specs/b-02-knowledge-base-crud-api/feature-spec.md
- 行为规格: docs/03-specs/b-02-knowledge-base-crud-api/behavior-spec.md
- API 规格: docs/03-specs/b-02-knowledge-base-crud-api/api-spec.md

## 验收标准

- [ ] `GET /api/knowledge-bases` 返回当前用户知识库列表（含置顶状态、排序）
- [ ] `POST /api/knowledge-bases` 创建知识库（name、description、icon）
- [ ] `PATCH /api/knowledge-bases/:id` 更新知识库（重命名、置顶、排序、图标）
- [ ] `DELETE /api/knowledge-bases/:id` 删除知识库（级联删除文档、文件夹、chunks）
- [ ] `GET /api/knowledge-bases/:id/folders` 获取文件夹列表（支持 parentId 参数）
- [ ] `POST /api/knowledge-bases/:id/folders` 创建文件夹（name、parentId）
- [ ] `PATCH /api/knowledge-bases/:id/folders/:folderId` 重命名文件夹
- [ ] `DELETE /api/knowledge-bases/:id/folders/:folderId` 删除文件夹（级联删除子文件夹和文档）
- [ ] 所有接口需要认证（使用 auth 中间件）
- [ ] 用户只能操作自己的知识库（userId 过滤）
- [ ] 响应格式统一，错误码规范（400/401/403/404）

## 阻塞于

- i-02-drizzle-orm-setup（需要数据库表）
- b-01-auth-api（需要认证中间件）

## 范围外

- 知识库共享/协作
- 知识库模板
- 文件夹权限控制

## Agent 简报

**分类：** enhancement
**摘要：** 知识库与虚拟文件夹的 CRUD API

**当前行为：**
后端无知识库管理接口。

**期望行为：**
前端可通过 API 管理知识库和文件夹，数据持久化到 PostgreSQL。

**关键接口：**
- `GET /api/knowledge-bases` — 列表
- `POST /api/knowledge-bases` — 创建
- `PATCH /api/knowledge-bases/:id` — 更新
- `DELETE /api/knowledge-bases/:id` — 删除
- `GET/POST/PATCH/DELETE /api/knowledge-bases/:id/folders/*` — 文件夹 CRUD

**验收标准：**
- [ ] 知识库列表 API
- [ ] 知识库创建 API
- [ ] 知识库更新 API
- [ ] 知识库删除 API（级联）
- [ ] 文件夹列表 API
- [ ] 文件夹创建 API
- [ ] 文件夹重命名 API
- [ ] 文件夹删除 API（级联）
- [ ] 接口需要认证
- [ ] 用户数据隔离
- [ ] 错误码规范

**范围外：**
- 知识库共享
- 知识库模板
- 文件夹权限
