---
issue_id: b-02-knowledge-base-crud-api
type: feature-spec
status: approved
summary: 为 GoferBot 提供知识库与虚拟文件夹的完整 CRUD API，支持用户数据隔离、JWT 认证、Zod 校验、统一响应格式与级联删除。范围外排除共享协作、模板及细粒度权限。
---
# Knowledge Base CRUD — 功能规格

> 对应 issue: `b-02-knowledge-base-crud-api`
> 依赖: `i-02-prisma-setup`, `i-09-nestjs-auth-system`
> 关联前端 issue: `f-05-knowledge-base-list`, `f-08-folder-management`

---

## 1. 目标

为 GoferBot 提供知识库（KnowledgeBase）和虚拟文件夹（Folder）的完整 CRUD API，支持用户创建、查看、更新、删除自己的知识库，并在知识库内管理文件夹层级。

---

## 2. 范围

### 2.1 范围内（MVP）

- 知识库 CRUD：列表、创建、更新、删除（级联）
- 文件夹 CRUD：列表、创建、重命名、删除（级联）
- 用户数据隔离：仅操作当前登录用户的数据
- JWT 认证保护：所有端点通过 `JwtAuthGuard` 保护
- Zod DTO 请求校验
- 统一响应格式（`ResponseInterceptor` 包装）

### 2.2 范围外（后续扩展）

- 知识库共享 / 协作
- 知识库模板
- 文件夹权限控制
- 文件夹移动（变更 parentId，本次仅支持创建时指定）
- 文档移动 API（由 `f-06-knowledge-base-file-manager` 覆盖）

---

## 3. 技术选型

| 组件 | 选型 | 说明 |
|------|------|------|
| ORM | Prisma | 复用项目已有的 PrismaService |
| 认证守卫 | JwtAuthGuard | NestJS Passport JWT 策略 |
| DTO 校验 | nestjs-zod + Zod | 与现有 auth DTO 保持一致 |
| 当前用户 | `@CurrentUser()` 装饰器 | 从 JWT payload 提取 `userId` |
| 响应格式 | ResponseInterceptor | 统一 `{ data: ... }` 包装 |

---

## 4. 架构设计

### 4.1 模块结构

```
packages/server/src/
├── modules/
│   └── knowledge-base/
│       ├── knowledge-base.module.ts
│       ├── knowledge-base.controller.ts
│       ├── knowledge-base.service.ts
│       ├── folder.controller.ts
│       ├── folder.service.ts
│       └── dto/
│           ├── create-kb.dto.ts
│           ├── update-kb.dto.ts
│           ├── create-folder.dto.ts
│           └── update-folder.dto.ts
```

### 4.2 数据流

```
[前端请求]
    ↓
JwtAuthGuard 验证 JWT
    ↓
@CurrentUser() 提取 userId
    ↓
ZodValidationPipe 校验 DTO
    ↓
Controller 调用 Service
    ↓
Service 通过 PrismaService 操作数据库
    ↓
Prisma 级联删除（onDelete: Cascade）
    ↓
ResponseInterceptor 包装为 { data: ... }
    ↓
返回 JSON
```

### 4.3 Prisma 模型关系

```
User (1)
  └── KnowledgeBase (N)
        ├── Folder (N)    — 级联删除
        ├── Document (N)  — 级联删除
        └── Chunk (N)     — 级联删除

Folder (1)
  ├── children Folder (N) — 级联删除（自关联）
  └── Document (N)        — 级联删除
```

> 级联删除由 Prisma schema 的 `onDelete: Cascade` 保证，无需业务层手动处理。

---

## 5. 接口对齐

### 5.1 与前端 issue 对齐

| 前端需求 | 对应 API |
|----------|----------|
| 知识库列表 | `GET /api/knowledge-bases` |
| 新建知识库 | `POST /api/knowledge-bases` |
| 置顶/取消置顶 | `PATCH /api/knowledge-bases/:id`（`isPinned`） |
| 拖拽排序 | `PATCH /api/knowledge-bases/:id`（`sortOrder`） |
| 重命名知识库 | `PATCH /api/knowledge-bases/:id`（`name`） |
| 删除知识库 | `DELETE /api/knowledge-bases/:id` |
| 文件夹列表 | `GET /api/knowledge-bases/:id/folders?parentId=...` |
| 创建文件夹 | `POST /api/knowledge-bases/:id/folders` |
| 重命名文件夹 | `PATCH /api/knowledge-bases/:id/folders/:folderId` |
| 删除文件夹 | `DELETE /api/knowledge-bases/:id/folders/:folderId` |

### 5.2 与认证系统对齐

- 所有端点使用 `JwtAuthGuard`，未登录返回 `401`
- 使用 `@CurrentUser('id')` 获取 `userId` 进行数据过滤
- 非本人资源返回 `403 Forbidden`

---

## 6. 安全要求

1. **用户隔离**：所有查询必须带 `where: { userId }`，禁止查询或操作其他用户数据。
2. **资源归属校验**：更新/删除知识库或文件夹前，先校验资源是否属于当前用户，否则返回 `403`。
3. **级联删除**：删除知识库时，Prisma 自动级联删除关联的 folders、documents、chunks；删除文件夹时，级联删除子文件夹和文档。
4. **输入校验**：名称字段限制长度，防止超长字符串攻击。
5. **错误响应**：不暴露内部堆栈、SQL 细节或数据库字段名。

---

## 7. 验收标准

- [ ] `GET /api/knowledge-bases` 返回当前用户知识库列表（含置顶状态、排序）
- [ ] `POST /api/knowledge-bases` 创建知识库（name、description、icon）
- [ ] `PATCH /api/knowledge-bases/:id` 更新知识库（重命名、置顶、排序、图标）
- [ ] `DELETE /api/knowledge-bases/:id` 删除知识库（级联删除文档、文件夹、chunks）
- [ ] `GET /api/knowledge-bases/:id/folders` 获取文件夹列表（支持 parentId 参数）
- [ ] `POST /api/knowledge-bases/:id/folders` 创建文件夹（name、parentId）
- [ ] `PATCH /api/knowledge-bases/:id/folders/:folderId` 重命名文件夹
- [ ] `DELETE /api/knowledge-bases/:id/folders/:folderId` 删除文件夹（级联删除子文件夹和文档）
- [ ] 所有接口需要认证（JwtAuthGuard）
- [ ] 用户只能操作自己的知识库（userId 过滤 + 403 校验）
- [ ] 响应格式统一（ResponseInterceptor），错误码规范（400/401/403/404）
- [ ] Zod DTO 校验失败返回 422（VALIDATION_ERROR）
