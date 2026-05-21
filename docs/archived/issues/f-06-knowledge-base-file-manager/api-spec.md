---
issue_id: f-06-knowledge-base-file-manager
type: api-spec
status: approved
summary: 4个文档端点（列表/删除/重命名移动）+ 复用已有文件夹端点，支持分页、排序、搜索和 folderId 过滤参数，JWT 认证。
---
# API 规格：知识库文件管理器

> 对应 issue: `f-06-knowledge-base-file-manager`
> 依赖: `b-02-knowledge-base-crud-api`

---

## 端点清单

### 文档端点

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| `GET` | `/api/knowledge-bases/:id/documents` | 获取知识库内文档列表 | 是（JWT） |
| `GET` | `/api/knowledge-bases/:id/documents?folderId=xxx` | 获取指定文件夹内文档 | 是（JWT） |
| `DELETE` | `/api/knowledge-bases/:id/documents/:docId` | 删除文档 | 是（JWT） |
| `PATCH` | `/api/knowledge-bases/:id/documents/:docId` | 重命名/移动文档 | 是（JWT） |

### 文件夹端点（已存在）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| `GET` | `/api/knowledge-bases/:id/folders` | 获取文件夹列表 | 是（JWT） |
| `GET` | `/api/knowledge-bases/:id/folders?parentId=xxx` | 获取子文件夹 | 是（JWT） |

---

## 端点详情

### GET /api/knowledge-bases/:id/documents

获取指定知识库（或文件夹）内的文档列表。

#### 请求

```http
GET /api/knowledge-bases/550e8400-e29b-41d4-a716-446655440000/documents?folderId=880e8400-e29b-41d4-a716-446655440003 HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

| 查询参数 | 类型 | 必填 | 说明 |
|----------|------|------|------|
| `folderId` | string | 否 | 文件夹 ID，不传则返回根目录文档 |

#### 响应 200 OK

```json
{
  "data": [
    {
      "id": "doc-uuid-1",
      "kbId": "550e8400-e29b-41d4-a716-446655440000",
      "folderId": "880e8400-e29b-41d4-a716-446655440003",
      "name": "产品需求文档.md",
      "ext": "md",
      "mimeType": "text/markdown",
      "size": 10240,
      "status": "ready",
      "createdAt": "2026-05-16T09:00:00.000Z",
      "updatedAt": "2026-05-16T09:00:00.000Z"
    },
    {
      "id": "doc-uuid-2",
      "kbId": "550e8400-e29b-41d4-a716-446655440000",
      "folderId": null,
      "name": "设计稿.pdf",
      "ext": "pdf",
      "mimeType": "application/pdf",
      "size": 2048000,
      "status": "parsing",
      "createdAt": "2026-05-16T09:30:00.000Z",
      "updatedAt": "2026-05-16T09:30:00.000Z"
    }
  ]
}
```

#### 文档状态

| 状态 | 含义 | 颜色 |
|------|------|------|
| `uploaded` | 已上传，待处理 | 灰色 |
| `parsing` | 解析中 | 蓝色 |
| `chunking` | 分块中 | 蓝色 |
| `indexing` | 索引中 | 蓝色 |
| `ready` | 可用 | 绿色 |
| `failed` | 处理失败 | 红色 |

---

## 数据模型

### Document

```typescript
interface Document {
  id: string
  kbId: string
  folderId: string | null
  name: string
  ext: string | null
  mimeType: string | null
  size: number | null
  status: 'uploaded' | 'parsing' | 'chunking' | 'indexing' | 'ready' | 'failed'
  createdAt: string
  updatedAt: string
}
```

### Folder

```typescript
interface Folder {
  id: string
  kbId: string
  parentId: string | null
  name: string
  createdAt: string
  updatedAt: string
}
```
