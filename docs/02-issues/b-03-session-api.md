状态: needs-triage
分类: enhancement

## 要构建的内容

实现会话 CRUD API，支持创建、查询、重命名、删除会话。

## 规格引用

- 功能规格: docs/03-specs/features/session-management/feature-spec.md
- 行为规格: docs/03-specs/features/session-management/behavior-spec.md
- API 规格: docs/03-specs/features/session-management/api-spec.md

## 验收标准

- [ ] `GET /api/sessions` 返回当前用户会话列表（含标题、最后消息时间、消息数量）
- [ ] `GET /api/sessions/:id` 返回单个会话详情（含消息列表）
- [ ] `POST /api/sessions` 创建新会话（返回新会话 ID，默认标题"新对话"）
- [ ] `POST /api/sessions/:id/rename` 重命名会话
- [ ] `DELETE /api/sessions/:id` 删除会话（级联删除消息）
- [ ] 会话列表按最后消息时间倒序排列
- [ ] 所有接口需要认证
- [ ] 用户只能操作自己的会话
- [ ] 响应包含分页信息（列表接口）
- [ ] 错误码规范（400/401/403/404）

## 阻塞于

- i-02-drizzle-orm-setup（需要 sessions/messages 表）
- b-01-auth-api（需要认证中间件）

## 范围外

- 会话归档（非删除的隐藏）
- 会话分享
- 会话标签/分类

## Agent 简报

**分类：** enhancement
**摘要：** 会话 CRUD API：创建、查询、重命名、删除

**当前行为：**
后端无会话管理接口。

**期望行为：**
前端可通过 API 管理问答会话，数据持久化到 PostgreSQL。

**关键接口：**
- `GET /api/sessions` — 列表
- `GET /api/sessions/:id` — 详情
- `POST /api/sessions` — 创建
- `POST /api/sessions/:id/rename` — 重命名
- `DELETE /api/sessions/:id` — 删除

**验收标准：**
- [ ] 会话列表 API（含最后消息时间、消息数量）
- [ ] 会话详情 API（含消息列表）
- [ ] 创建会话 API
- [ ] 重命名会话 API
- [ ] 删除会话 API（级联删除消息）
- [ ] 列表按时间倒序
- [ ] 接口需要认证
- [ ] 用户数据隔离
- [ ] 列表分页
- [ ] 错误码规范

**范围外：**
- 会话归档
- 会话分享
- 会话标签
