---
issue_id: f-07-file-upload-component
type: api-spec
status: approved
summary: 核心端点 POST /api/knowledge-bases/:id/documents，multipart/form-data 上传，支持 folderId 参数，Bearer JWT 认证，返回文档元数据含处理状态。
---
# API 规格：文件上传组件

> 对应 issue: `f-07-file-upload-component`

---

## 端点

### POST /api/knowledge-bases/:id/documents

上传文件到指定知识库。

#### 认证

Bearer Token

#### 请求

```http
POST /api/knowledge-bases/550e8400-e29b-41d4-a716-446655440000/documents HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: multipart/form-data

------WebKitFormBoundary
Content-Disposition: form-data; name="file"; filename="document.md"
Content-Type: text/markdown

[文件内容]
------WebKitFormBoundary
Content-Disposition: form-data; name="folderId"

880e8400-e29b-41d4-a716-446655440003
------WebKitFormBoundary--
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `file` | File | 是 | 文件内容 |
| `folderId` | string | 否 | 目标文件夹 ID，不传则上传到根目录 |

#### 响应 201 Created

```json
{
  "data": {
    "id": "doc-uuid-1",
    "kbId": "550e8400-e29b-41d4-a716-446655440000",
    "folderId": null,
    "name": "document.md",
    "ext": "md",
    "mimeType": "text/markdown",
    "size": 10240,
    "status": "uploaded",
    "createdAt": "2026-05-16T09:00:00.000Z",
    "updatedAt": "2026-05-16T09:00:00.000Z"
  }
}
```

#### 错误响应

| 状态码 | 错误码 | 说明 |
|--------|--------|------|
| 400 | `VALIDATION_ERROR` | 请求格式错误 |
| 401 | `AUTH_ERROR` | 未登录 |
| 403 | `FORBIDDEN` | 无权访问该知识库 |
| 404 | `NOT_FOUND` | 知识库不存在 |
| 413 | `PAYLOAD_TOO_LARGE` | 文件超过大小限制 |
| 415 | `UNSUPPORTED_TYPE` | 不支持的文件类型 |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 |

#### 异步行为

上传成功后，后端异步执行：
1. 保存文件到 MinIO
2. 解析文档内容
3. 文本分块
4. 向量化写入 Milvus
5. 更新文档状态（uploaded → parsing → chunking → indexing → ready）

客户端通过轮询文件列表获取最新状态。
