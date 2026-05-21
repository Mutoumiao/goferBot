---
issue_id: f-08-folder-management
type: api-spec
status: approved
summary: 4个端点：创建文件夹 POST /folders、重命名 PATCH /folders/:folderId、级联删除 DELETE /folders/:folderId、移动文档 PATCH /documents/:docId、JWT 认证。
---
# API 规格：文件夹管理

> 对应 issue: `f-08-folder-management`
> 依赖: `b-02-knowledge-base-crud-api`

---

## 端点清单

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| `POST` | `/api/knowledge-bases/:id/folders` | 创建文件夹 | 是（JWT） |
| `PATCH` | `/api/knowledge-bases/:id/folders/:folderId` | 重命名文件夹 | 是（JWT） |
| `DELETE` | `/api/knowledge-bases/:id/folders/:folderId` | 删除文件夹（级联） | 是（JWT） |
| `PATCH` | `/api/knowledge-bases/:id/documents/:docId` | 移动文档 | 是（JWT） |

---

## 端点详情

### POST /api/knowledge-bases/:id/folders

创建文件夹（详见 knowledge-base-crud/api-spec.md 3.6）。

### PATCH /api/knowledge-bases/:id/folders/:folderId

重命名文件夹（详见 knowledge-base-crud/api-spec.md 3.7）。

### DELETE /api/knowledge-bases/:id/folders/:folderId

删除文件夹（详见 knowledge-base-crud/api-spec.md 3.8）。

### PATCH /api/knowledge-bases/:id/documents/:docId

移动文档到不同文件夹，或修改文档名称。

#### 请求

```http
PATCH /api/knowledge-bases/550e8400-e29b-41d4-a716-446655440000/documents/doc-uuid-1 HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "folderId": "880e8400-e29b-41d4-a716-446655440003",
  "name": "新名称.md"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `folderId` | string / null | 否 | 目标文件夹 ID，传 null 移到根目录 |
| `name` | string | 否 | 新文件名 |

#### 响应 200 OK

```json
{
  "data": {
    "id": "doc-uuid-1",
    "kbId": "550e8400-e29b-41d4-a716-446655440000",
    "folderId": "880e8400-e29b-41d4-a716-446655440003",
    "name": "新名称.md",
    "ext": "md",
    "mimeType": "text/markdown",
    "size": 10240,
    "status": "ready",
    "createdAt": "2026-05-16T09:00:00.000Z",
    "updatedAt": "2026-05-16T09:05:00.000Z"
  }
}
```

#### 错误响应

| 状态码 | 错误码 | 说明 |
|--------|--------|------|
| 400 | `VALIDATION_ERROR` | 参数错误 |
| 401 | `AUTH_ERROR` | 未登录 |
| 403 | `FORBIDDEN` | 无权访问 |
| 404 | `NOT_FOUND` | 知识库/文档/文件夹不存在 |
| 500 | `INTERNAL_ERROR` | 服务器错误 |
