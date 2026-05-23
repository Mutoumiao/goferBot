# API 规格：DocumentController 测试

## 端点

所有端点挂载在 `/api/knowledge-bases/:kbId/documents`，统一受 `JwtAuthGuard` 保护。

### GET /api/knowledge-bases/:kbId/documents

#### 认证
Bearer Token（JWT）

#### 请求参数
| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| kbId | path | string(uuid) | 是 | 知识库 ID |
| folderId | query | string(uuid) | 否 | 文件夹 ID，筛选用 |

#### 响应 200
```json
{
  "data": [
    {
      "id": "uuid",
      "kbId": "uuid",
      "folderId": "uuid|null",
      "name": "string",
      "ext": "string|null",
      "mimeType": "string|null",
      "size": "number|null",
      "storageKey": "string",
      "hash": "string|null",
      "status": "uploaded",
      "errorMessage": "string|null",
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ]
}
```
- 按 `createdAt` desc 排序

#### 错误码
| 码 | 场景 | 响应体 |
|----|------|--------|
| 400 | folderId 非 uuid 格式 | `{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }` |
| 401 | 未携带 Authorization 或 JWT 无效/过期 | `{ "error": { "code": "AUTH_ERROR", "message": "未登录或令牌已过期" } }` |
| 403 | 用户不是知识库所有者 | `{ "error": { "code": "FORBIDDEN", "message": "..." } }` |
| 404 | 知识库不存在 | `{ "error": { "code": "NOT_FOUND", "message": "..." } }` |

---

### POST /api/knowledge-bases/:kbId/documents/upload

#### 认证
Bearer Token（JWT）

#### 请求
- Content-Type: `multipart/form-data`
- 字段：
  - `file`: 二进制文件（必填）
  - `folderId`: string(uuid)，可选

#### 文件校验规则
- 大小：≤ 50MB（`MAX_SIZE = 50 * 1024 * 1024`）
- 扩展名：`md`、`txt`、`pdf`
- MIME 类型：`text/markdown`、`text/x-markdown`、`text/plain`、`application/pdf`
- 文件名：不含 `..`、`/`、`\`，去除不可打印字符和首尾空格

#### 响应 201
```json
{
  "data": {
    "id": "uuid",
    "kbId": "uuid",
    "folderId": "uuid|null",
    "name": "string（含扩展名）",
    "ext": "md|txt|pdf",
    "mimeType": "string",
    "size": "number",
    "storageKey": "string",
    "hash": "string|null",
    "status": "uploaded",
    "createdAt": "ISO8601",
    "updatedAt": "ISO8601"
  }
}
```

#### 错误码
| 码 | 场景 | 响应体 |
|----|------|--------|
| 400 | 请求不是 multipart | `{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }` |
| 401 | 未认证 | 同上 |
| 403 | 非知识库所有者 | 同上 |
| 404 | 知识库不存在 | 同上 |
| 413 | 文件超过 50MB | `{ "error": { "code": "PAYLOAD_TOO_LARGE", "message": "文件超过 50MB 限制" } }` |
| 415 | 文件名包含非法字符 | `{ "error": { "code": "UNSUPPORTED_TYPE", "message": "..." } }` |
| 415 | 文件类型不支持（扩展名或 MIME） | `{ "error": { "code": "UNSUPPORTED_TYPE", "message": "..." } }` |

---

### POST /api/knowledge-bases/:kbId/documents

#### 认证
Bearer Token（JWT）

#### 请求
```json
{
  "name": "string (1-255 chars)",
  "folderId": "string(uuid) | null"   // 可选
}
```

#### 响应 201
```json
{
  "data": {
    "id": "uuid",
    "kbId": "uuid",
    "folderId": "uuid|null",
    "name": "string",
    "ext": null,
    "mimeType": null,
    "size": null,
    "storageKey": "string",
    "hash": null,
    "status": "uploaded",
    "createdAt": "ISO8601",
    "updatedAt": "ISO8601"
  }
}
```

#### 错误码
| 码 | 场景 | 响应体 |
|----|------|--------|
| 400 | name 为空/超过 255 字符 | `{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }` |
| 400 | folderId 非 uuid | 同上 |
| 401 | 未认证 | 同上 |
| 403 | 非知识库所有者 | 同上 |
| 404 | 知识库不存在 | 同上 |

---

### PATCH /api/knowledge-bases/:kbId/documents/:docId

#### 认证
Bearer Token（JWT）

#### 请求
```json
{
  "name": "string (1-255 chars)",   // 可选
  "folderId": "string(uuid) | null"   // 可选
}
```

#### 响应 200
```json
{
  "data": {
    "id": "uuid",
    "kbId": "uuid",
    "folderId": "uuid|null",
    "name": "string",
    "ext": "string|null",
    "mimeType": "string|null",
    "size": "number|null",
    "storageKey": "string",
    "hash": "string|null",
    "status": "string",
    "createdAt": "ISO8601",
    "updatedAt": "ISO8601"
  }
}
```

#### 错误码
| 码 | 场景 | 响应体 |
|----|------|--------|
| 400 | name 为空/超过 255 字符 | `{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }` |
| 400 | folderId 非 uuid | 同上 |
| 401 | 未认证 | 同上 |
| 403 | 非知识库所有者 | 同上 |
| 404 | 知识库不存在 | 同上 |
| 404 | 文档不存在或不属于该知识库 | 同上 |

---

### DELETE /api/knowledge-bases/:kbId/documents/:docId

#### 认证
Bearer Token（JWT）

#### 响应 200
```json
{
  "data": {
    "id": "uuid",
    "deleted": true
  }
}
```

#### 错误码
| 码 | 场景 | 响应体 |
|----|------|--------|
| 401 | 未认证 | 同上 |
| 403 | 非知识库所有者 | 同上 |
| 404 | 知识库不存在 | 同上 |
| 404 | 文档不存在或不属于该知识库 | 同上 |

---

## 测试映射

| 场景 | 测试文件 | 测试用例 |
|------|----------|----------|
| 正常请求 - 列表 | `tests/issues/b-03-document-api-testing/document.spec.ts` | `AC-01: lists documents for owned knowledge base` |
| 正常请求 - 上传 | `tests/issues/b-03-document-api-testing/document.spec.ts` | `AC-02: uploads a valid file and creates document record` |
| 正常请求 - 创建 | `tests/issues/b-03-document-api-testing/document.spec.ts` | `AC-03: creates a document with valid data` |
| 正常请求 - 更新 | `tests/issues/b-03-document-api-testing/document.spec.ts` | `AC-04: updates a document with valid data` |
| 正常请求 - 删除 | `tests/issues/b-03-document-api-testing/document.spec.ts` | `AC-05: deletes a document and returns confirmation` |
| 正常请求 - 空列表 | `tests/issues/b-03-document-api-testing/document.spec.ts` | `AC-06: returns empty array when no documents exist` |
| 正常请求 - 按文件夹筛选 | `tests/issues/b-03-document-api-testing/document.spec.ts` | `AC-07: lists documents filtered by folderId` |
| 正常请求 - 更新空 body | `tests/issues/b-03-document-api-testing/document.spec.ts` | `AC-08: updates document with empty body returns unchanged` |
| 参数错误 - name 为空字符串 | `tests/issues/b-03-document-api-testing/document.spec.ts` | `AC-09: returns 400 when name is empty string` |
| 参数错误 - name 超过 255 字符 | `tests/issues/b-03-document-api-testing/document.spec.ts` | `AC-10: returns 400 when name exceeds 255 chars` |
| 参数错误 - folderId 非 uuid | `tests/issues/b-03-document-api-testing/document.spec.ts` | `AC-11: returns 400 when folderId is not uuid` |
| 参数错误 - query folderId 非 uuid | `tests/issues/b-03-document-api-testing/document.spec.ts` | `AC-12: returns 400 when query folderId is not uuid` |
| 参数错误 - 文件过大 | `tests/issues/b-03-document-api-testing/document.spec.ts` | `AC-13: returns 413 for file exceeding 50MB` |
| 参数错误 - 不支持的文件类型 | `tests/issues/b-03-document-api-testing/document.spec.ts` | `AC-14: returns 415 for unsupported file type` |
| 参数错误 - 非法文件名 | `tests/issues/b-03-document-api-testing/document.spec.ts` | `AC-15: returns 415 for filename with illegal characters` |
| 参数错误 - 上传空文件 | `tests/issues/b-03-document-api-testing/document.spec.ts` | `AC-16: accepts empty file (0 bytes) as valid` |
| 认证错误 | `tests/issues/b-03-document-api-testing/document.spec.ts` | `AC-17: returns 401 without valid JWT` |
| 权限错误 | `tests/issues/b-03-document-api-testing/document.spec.ts` | `AC-18: returns 403 for non-owner access` |
| 资源不存在 - 知识库 | `tests/issues/b-03-document-api-testing/document.spec.ts` | `AC-19: returns 404 for non-existent knowledge base` |
| 资源不存在 - 文档 | `tests/issues/b-03-document-api-testing/document.spec.ts` | `AC-20: returns 404 for non-existent document` |
| 资源不存在 - docId 格式非法 | `tests/issues/b-03-document-api-testing/document.spec.ts` | `AC-21: returns 404 for invalid docId format` |
