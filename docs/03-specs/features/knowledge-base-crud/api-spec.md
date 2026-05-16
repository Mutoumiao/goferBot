# Knowledge Base CRUD — API 规格

> 对应 issue: `b-02-knowledge-base-crud-api`
> 依赖: `i-02-prisma-setup`, `i-09-nestjs-auth-system`

---

## 1. 基础信息

- **Base URL**: `http://localhost:3000`（Sidecar 开发端口）
- **Content-Type**: `application/json`
- **认证方式**: Bearer Token（`Authorization: Bearer <accessToken>`）
- **响应包装**: 所有成功响应经 `ResponseInterceptor` 包装为 `{ data: ... }`

---

## 2. 端点清单

### 2.1 知识库端点

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| `GET` | `/api/knowledge-bases` | 获取当前用户知识库列表 | 是（JWT） |
| `POST` | `/api/knowledge-bases` | 创建知识库 | 是（JWT） |
| `PATCH` | `/api/knowledge-bases/:id` | 更新知识库 | 是（JWT） |
| `DELETE` | `/api/knowledge-bases/:id` | 删除知识库（级联） | 是（JWT） |

### 2.2 文件夹端点

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| `GET` | `/api/knowledge-bases/:id/folders` | 获取知识库内文件夹列表 | 是（JWT） |
| `POST` | `/api/knowledge-bases/:id/folders` | 在知识库内创建文件夹 | 是（JWT） |
| `PATCH` | `/api/knowledge-bases/:id/folders/:folderId` | 重命名文件夹 | 是（JWT） |
| `DELETE` | `/api/knowledge-bases/:id/folders/:folderId` | 删除文件夹（级联） | 是（JWT） |

---

## 3. 端点详情

### 3.1 GET /api/knowledge-bases

获取当前登录用户的知识库列表，按 `sortOrder` 升序、`createdAt` 降序排列。

#### 认证

`Bearer Token` — 在请求头中携带 `Authorization: Bearer <accessToken>`。

#### 请求

```http
GET /api/knowledge-bases HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### 响应 200 OK

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data": {
    "items": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "userId": "user-uuid",
        "name": "工作文档",
        "description": "日常工作相关的知识库",
        "isPinned": true,
        "sortOrder": 0,
        "icon": "📁",
        "createdAt": "2026-05-16T08:00:00.000Z",
        "updatedAt": "2026-05-16T08:00:00.000Z"
      },
      {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "userId": "user-uuid",
        "name": "学习笔记",
        "description": null,
        "isPinned": false,
        "sortOrder": 1,
        "icon": null,
        "createdAt": "2026-05-15T10:30:00.000Z",
        "updatedAt": "2026-05-15T10:30:00.000Z"
      }
    ]
  }
}
```

#### 错误响应

| 状态码 | 响应体 | 说明 |
|--------|--------|------|
| `401` | `{ "error": { "code": "AUTH_ERROR", "message": "未登录或令牌已过期" } }` | JWT 缺失或无效 |
| `500` | `{ "error": { "code": "INTERNAL_ERROR", "message": "服务器内部错误" } }` | 服务器内部错误 |

---

### 3.2 POST /api/knowledge-bases

创建新的知识库。

#### 认证

`Bearer Token`

#### 请求

```http
POST /api/knowledge-bases HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "name": "新项目",
  "description": "项目相关文档",
  "icon": "🚀"
}
```

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `name` | string | 是 | 长度 1-100，非空 |
| `description` | string | 否 | 长度 0-500 |
| `icon` | string | 否 | 长度 0-10，允许 emoji 或短字符串 |

#### 响应 201 Created

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "data": {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "userId": "user-uuid",
    "name": "新项目",
    "description": "项目相关文档",
    "isPinned": false,
    "sortOrder": 2,
    "icon": "🚀",
    "createdAt": "2026-05-16T12:00:00.000Z",
    "updatedAt": "2026-05-16T12:00:00.000Z"
  }
}
```

> `sortOrder` 由服务端自动计算（当前用户最大 sortOrder + 1），默认 `isPinned: false`。

#### 错误响应

| 状态码 | 响应体 | 说明 |
|--------|--------|------|
| `400` | `{ "error": { "code": "VALIDATION_ERROR", "message": "请求参数校验失败", "details": [...] } }` | 字段缺失或格式非法 |
| `401` | `{ "error": { "code": "AUTH_ERROR", "message": "未登录或令牌已过期" } }` | JWT 缺失或无效 |
| `500` | `{ "error": { "code": "INTERNAL_ERROR", "message": "服务器内部错误" } }` | 服务器内部错误 |

---

### 3.3 PATCH /api/knowledge-bases/:id

更新知识库信息，支持部分更新。

#### 认证

`Bearer Token`

#### 请求

```http
PATCH /api/knowledge-bases/550e8400-e29b-41d4-a716-446655440000 HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "name": "重命名后的知识库",
  "isPinned": true,
  "sortOrder": 0,
  "icon": "📌"
}
```

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `name` | string | 否 | 长度 1-100 |
| `description` | string | 否 | 长度 0-500，传 `null` 清空 |
| `isPinned` | boolean | 否 | — |
| `sortOrder` | integer | 否 | ≥ 0 |
| `icon` | string / null | 否 | 长度 0-10，传 `null` 清空 |

#### 响应 200 OK

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "user-uuid",
    "name": "重命名后的知识库",
    "description": "日常工作相关的知识库",
    "isPinned": true,
    "sortOrder": 0,
    "icon": "📌",
    "createdAt": "2026-05-16T08:00:00.000Z",
    "updatedAt": "2026-05-16T12:30:00.000Z"
  }
}
```

#### 错误响应

| 状态码 | 响应体 | 说明 |
|--------|--------|------|
| `400` | `{ "error": { "code": "VALIDATION_ERROR", "message": "请求参数校验失败", "details": [...] } }` | 字段格式非法 |
| `401` | `{ "error": { "code": "AUTH_ERROR", "message": "未登录或令牌已过期" } }` | JWT 缺失或无效 |
| `403` | `{ "error": { "code": "FORBIDDEN", "message": "无权访问该资源" } }` | 知识库不属于当前用户 |
| `404` | `{ "error": { "code": "NOT_FOUND", "message": "知识库不存在" } }` | ID 对应的知识库不存在 |
| `500` | `{ "error": { "code": "INTERNAL_ERROR", "message": "服务器内部错误" } }` | 服务器内部错误 |

---

### 3.4 DELETE /api/knowledge-bases/:id

删除知识库及其所有关联数据（文件夹、文档、chunks）。

#### 认证

`Bearer Token`

#### 请求

```http
DELETE /api/knowledge-bases/550e8400-e29b-41d4-a716-446655440000 HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### 响应 200 OK

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "deleted": true
  }
}
```

#### 错误响应

| 状态码 | 响应体 | 说明 |
|--------|--------|------|
| `401` | `{ "error": { "code": "AUTH_ERROR", "message": "未登录或令牌已过期" } }` | JWT 缺失或无效 |
| `403` | `{ "error": { "code": "FORBIDDEN", "message": "无权访问该资源" } }` | 知识库不属于当前用户 |
| `404` | `{ "error": { "code": "NOT_FOUND", "message": "知识库不存在" } }` | ID 对应的知识库不存在 |
| `500` | `{ "error": { "code": "INTERNAL_ERROR", "message": "服务器内部错误" } }` | 服务器内部错误 |

---

### 3.5 GET /api/knowledge-bases/:id/folders

获取指定知识库内的文件夹列表。

#### 认证

`Bearer Token`

#### 请求

```http
GET /api/knowledge-bases/550e8400-e29b-41d4-a716-446655440000/folders?parentId=parent-folder-uuid HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

| 查询参数 | 类型 | 必填 | 说明 |
|----------|------|------|------|
| `parentId` | string | 否 | 父文件夹 ID，不传则返回根目录文件夹 |

#### 响应 200 OK

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data": {
    "items": [
      {
        "id": "880e8400-e29b-41d4-a716-446655440003",
        "kbId": "550e8400-e29b-41d4-a716-446655440000",
        "parentId": null,
        "name": "产品文档",
        "createdAt": "2026-05-16T09:00:00.000Z"
      },
      {
        "id": "990e8400-e29b-41d4-a716-446655440004",
        "kbId": "550e8400-e29b-41d4-a716-446655440000",
        "parentId": null,
        "name": "技术文档",
        "createdAt": "2026-05-16T09:30:00.000Z"
      }
    ]
  }
}
```

#### 错误响应

| 状态码 | 响应体 | 说明 |
|--------|--------|------|
| `401` | `{ "error": { "code": "AUTH_ERROR", "message": "未登录或令牌已过期" } }` | JWT 缺失或无效 |
| `403` | `{ "error": { "code": "FORBIDDEN", "message": "无权访问该资源" } }` | 知识库不属于当前用户 |
| `404` | `{ "error": { "code": "NOT_FOUND", "message": "知识库不存在" } }` | 知识库 ID 不存在 |
| `500` | `{ "error": { "code": "INTERNAL_ERROR", "message": "服务器内部错误" } }` | 服务器内部错误 |

---

### 3.6 POST /api/knowledge-bases/:id/folders

在指定知识库内创建文件夹。

#### 认证

`Bearer Token`

#### 请求

```http
POST /api/knowledge-bases/550e8400-e29b-41d4-a716-446655440000/folders HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "name": "新文件夹",
  "parentId": "880e8400-e29b-41d4-a716-446655440003"
}
```

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `name` | string | 是 | 长度 1-100，非空 |
| `parentId` | string / null | 否 | 父文件夹 ID，不传或传 `null` 表示创建在根目录 |

#### 响应 201 Created

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "data": {
    "id": "aa0e8400-e29b-41d4-a716-446655440005",
    "kbId": "550e8400-e29b-41d4-a716-446655440000",
    "parentId": "880e8400-e29b-41d4-a716-446655440003",
    "name": "新文件夹",
    "createdAt": "2026-05-16T13:00:00.000Z"
  }
}
```

#### 错误响应

| 状态码 | 响应体 | 说明 |
|--------|--------|------|
| `400` | `{ "error": { "code": "VALIDATION_ERROR", "message": "请求参数校验失败", "details": [...] } }` | 字段缺失或格式非法 |
| `401` | `{ "error": { "code": "AUTH_ERROR", "message": "未登录或令牌已过期" } }` | JWT 缺失或无效 |
| `403` | `{ "error": { "code": "FORBIDDEN", "message": "无权访问该资源" } }` | 知识库不属于当前用户 |
| `404` | `{ "error": { "code": "NOT_FOUND", "message": "知识库不存在" } }` | 知识库 ID 不存在 |
| `404` | `{ "error": { "code": "NOT_FOUND", "message": "父文件夹不存在" } }` | `parentId` 对应的文件夹不存在或不属于该知识库 |
| `500` | `{ "error": { "code": "INTERNAL_ERROR", "message": "服务器内部错误" } }` | 服务器内部错误 |

---

### 3.7 PATCH /api/knowledge-bases/:id/folders/:folderId

重命名文件夹。

#### 认证

`Bearer Token`

#### 请求

```http
PATCH /api/knowledge-bases/550e8400-e29b-41d4-a716-446655440000/folders/aa0e8400-e29b-41d4-a716-446655440005 HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "name": "重命名后的文件夹"
}
```

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `name` | string | 是 | 长度 1-100，非空 |

#### 响应 200 OK

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data": {
    "id": "aa0e8400-e29b-41d4-a716-446655440005",
    "kbId": "550e8400-e29b-41d4-a716-446655440000",
    "parentId": "880e8400-e29b-41d4-a716-446655440003",
    "name": "重命名后的文件夹",
    "createdAt": "2026-05-16T13:00:00.000Z"
  }
}
```

#### 错误响应

| 状态码 | 响应体 | 说明 |
|--------|--------|------|
| `400` | `{ "error": { "code": "VALIDATION_ERROR", "message": "请求参数校验失败", "details": [...] } }` | 字段格式非法 |
| `401` | `{ "error": { "code": "AUTH_ERROR", "message": "未登录或令牌已过期" } }` | JWT 缺失或无效 |
| `403` | `{ "error": { "code": "FORBIDDEN", "message": "无权访问该资源" } }` | 知识库或文件夹不属于当前用户 |
| `404` | `{ "error": { "code": "NOT_FOUND", "message": "文件夹不存在" } }` | 文件夹 ID 不存在 |
| `500` | `{ "error": { "code": "INTERNAL_ERROR", "message": "服务器内部错误" } }` | 服务器内部错误 |

---

### 3.8 DELETE /api/knowledge-bases/:id/folders/:folderId

删除文件夹及其所有子内容（子文件夹、文档）。

#### 认证

`Bearer Token`

#### 请求

```http
DELETE /api/knowledge-bases/550e8400-e29b-41d4-a716-446655440000/folders/aa0e8400-e29b-41d4-a716-446655440005 HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### 响应 200 OK

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data": {
    "id": "aa0e8400-e29b-41d4-a716-446655440005",
    "deleted": true
  }
}
```

#### 错误响应

| 状态码 | 响应体 | 说明 |
|--------|--------|------|
| `401` | `{ "error": { "code": "AUTH_ERROR", "message": "未登录或令牌已过期" } }` | JWT 缺失或无效 |
| `403` | `{ "error": { "code": "FORBIDDEN", "message": "无权访问该资源" } }` | 知识库或文件夹不属于当前用户 |
| `404` | `{ "error": { "code": "NOT_FOUND", "message": "文件夹不存在" } }` | 文件夹 ID 不存在 |
| `500` | `{ "error": { "code": "INTERNAL_ERROR", "message": "服务器内部错误" } }` | 服务器内部错误 |

---

## 4. DTO 定义（Zod Schema）

### 4.1 CreateKbDto

```typescript
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const createKbSchema = z.object({
  name: z.string().min(1, '知识库名称不能为空').max(100, '名称过长'),
  description: z.string().max(500, '描述过长').optional(),
  icon: z.string().max(10, '图标过长').optional(),
})

export class CreateKbDto extends createZodDto(createKbSchema) {}
```

### 4.2 UpdateKbDto

```typescript
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const updateKbSchema = z.object({
  name: z.string().min(1, '知识库名称不能为空').max(100, '名称过长').optional(),
  description: z.string().max(500, '描述过长').nullable().optional(),
  isPinned: z.boolean().optional(),
  sortOrder: z.number().int().min(0, '排序值不能为负数').optional(),
  icon: z.string().max(10, '图标过长').nullable().optional(),
})

export class UpdateKbDto extends createZodDto(updateKbSchema) {}
```

### 4.3 CreateFolderDto

```typescript
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const createFolderSchema = z.object({
  name: z.string().min(1, '文件夹名称不能为空').max(100, '名称过长'),
  parentId: z.string().uuid('parentId 格式非法').nullable().optional(),
})

export class CreateFolderDto extends createZodDto(createFolderSchema) {}
```

### 4.4 UpdateFolderDto

```typescript
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const updateFolderSchema = z.object({
  name: z.string().min(1, '文件夹名称不能为空').max(100, '名称过长'),
})

export class UpdateFolderDto extends createZodDto(updateFolderSchema) {}
```

---

## 5. NestJS 控制器示例

### 5.1 KnowledgeBaseController

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../../auth/guards/jwt.guard.js'
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { KnowledgeBaseService } from './knowledge-base.service.js'
import { CreateKbDto, createKbSchema } from './dto/create-kb.dto.js'
import { UpdateKbDto, updateKbSchema } from './dto/update-kb.dto.js'

@Controller('api/knowledge-bases')
@UseGuards(JwtAuthGuard)
export class KnowledgeBaseController {
  constructor(private readonly kbService: KnowledgeBaseService) {}

  @Get()
  async list(@CurrentUser('id') userId: string) {
    return this.kbService.list(userId)
  }

  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(createKbSchema)) dto: CreateKbDto,
  ) {
    return this.kbService.create(userId, dto)
  }

  @Patch(':id')
  async update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateKbSchema)) dto: UpdateKbDto,
  ) {
    return this.kbService.update(userId, id, dto)
  }

  @Delete(':id')
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.kbService.remove(userId, id)
  }
}
```

### 5.2 FolderController

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../../auth/guards/jwt.guard.js'
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { FolderService } from './folder.service.js'
import { CreateFolderDto, createFolderSchema } from './dto/create-folder.dto.js'
import { UpdateFolderDto, updateFolderSchema } from './dto/update-folder.dto.js'

@Controller('api/knowledge-bases/:kbId/folders')
@UseGuards(JwtAuthGuard)
export class FolderController {
  constructor(private readonly folderService: FolderService) {}

  @Get()
  async list(
    @CurrentUser('id') userId: string,
    @Param('kbId') kbId: string,
    @Query('parentId') parentId?: string,
  ) {
    return this.folderService.list(userId, kbId, parentId)
  }

  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @Param('kbId') kbId: string,
    @Body(new ZodValidationPipe(createFolderSchema)) dto: CreateFolderDto,
  ) {
    return this.folderService.create(userId, kbId, dto)
  }

  @Patch(':folderId')
  async update(
    @CurrentUser('id') userId: string,
    @Param('kbId') kbId: string,
    @Param('folderId') folderId: string,
    @Body(new ZodValidationPipe(updateFolderSchema)) dto: UpdateFolderDto,
  ) {
    return this.folderService.update(userId, kbId, folderId, dto)
  }

  @Delete(':folderId')
  async remove(
    @CurrentUser('id') userId: string,
    @Param('kbId') kbId: string,
    @Param('folderId') folderId: string,
  ) {
    return this.folderService.remove(userId, kbId, folderId)
  }
}
```

---

## 6. 数据模型（API 层面）

### 6.1 KnowledgeBase

```typescript
interface KnowledgeBase {
  id: string           // UUID
  userId: string       // 关联用户 ID
  name: string         // 知识库名称
  description: string | null
  isPinned: boolean    // 是否置顶
  sortOrder: number    // 排序值
  icon: string | null  // 图标（emoji 或短字符串）
  createdAt: string    // ISO 8601
  updatedAt: string    // ISO 8601
}
```

### 6.2 Folder

```typescript
interface Folder {
  id: string           // UUID
  kbId: string         // 所属知识库 ID
  parentId: string | null // 父文件夹 ID（null 表示根目录）
  name: string         // 文件夹名称
  createdAt: string    // ISO 8601
}
```

---

## 7. 错误码汇总

| 状态码 | 错误码 | 含义 | 使用场景 |
|--------|--------|------|----------|
| `200` | — | OK | 成功响应（GET / PATCH / DELETE） |
| `201` | — | Created | 创建成功（POST） |
| `400` | `VALIDATION_ERROR` | Bad Request | 请求体非法、字段缺失、格式错误 |
| `401` | `AUTH_ERROR` | Unauthorized | JWT 缺失、无效或已过期 |
| `403` | `FORBIDDEN` | Forbidden | 资源不属于当前用户 |
| `404` | `NOT_FOUND` | Not Found | 知识库或文件夹不存在 |
| `422` | `VALIDATION_ERROR` | Unprocessable Entity | Zod DTO 校验失败（ZodValidationPipe 默认） |
| `500` | `INTERNAL_ERROR` | Internal Server Error | 服务器内部异常 |

---

## 8. 边界情况

| 场景 | 预期行为 |
|------|----------|
| 创建知识库时名称已存在（同用户下） | 允许重复名称，由前端展示区分 |
| 删除知识库后访问其文件夹端点 | `404` 知识库不存在 |
| 删除包含子文件夹的父文件夹 | Prisma `onDelete: Cascade` 自动级联删除所有子文件夹和关联文档 |
| 在不存在知识库下创建文件夹 | `404` 知识库不存在 |
| `parentId` 指向其他知识库的文件夹 | `404` 父文件夹不存在 |
| 未携带 JWT 访问任意端点 | `401` 未登录或令牌已过期 |
| 尝试操作其他用户的知识库 | `403` 无权访问该资源 |
| 同时更新 `isPinned` 和 `sortOrder` | 服务端按接收值更新，前端负责重新计算排序 |
