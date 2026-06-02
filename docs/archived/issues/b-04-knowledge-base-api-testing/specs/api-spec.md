# API 规格：KnowledgeBaseController 测试

## 端点

所有端点挂载在 `/api/knowledge-bases`，统一受 `JwtAuthGuard` 保护。

### GET /api/knowledge-bases

#### 认证
Bearer Token（JWT）

#### 响应 200
```json
{
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "name": "string",
      "description": "string | null",
      "isPinned": false,
      "sortOrder": 0,
      "icon": "string | null",
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ]
}
```
- 按 sortOrder asc + createdAt desc 排序
- 仅返回当前用户的知识库

#### 错误码
| 码 | 场景 | 响应体 |
|----|------|--------|
| 401 | 未携带 Authorization 或 JWT 无效/过期 | `{ "error": { "code": "AUTH_ERROR", "message": "..." } }` |

---

### POST /api/knowledge-bases

#### 认证
Bearer Token（JWT）

#### 请求
```json
{
  "name": "string (1-100 chars)",
  "description": "string (max 500)",     // 可选
  "icon": "string (max 10)"              // 可选
}
```

#### 响应 201
```json
{
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "name": "string",
    "description": "string | null",
    "isPinned": false,
    "sortOrder": 0,
    "icon": "string | null",
    "createdAt": "ISO8601",
    "updatedAt": "ISO8601"
  }
}
```

#### 错误码
| 码 | 场景 | 响应体 |
|----|------|--------|
| 400 | name 为空/超过 100 字符 | `{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }` |
| 400 | description 超过 500 字符 | `{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }` |
| 400 | icon 超过 10 字符 | `{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }` |
| 401 | 未认证 | 同上 |

---

### PATCH /api/knowledge-bases/:id

#### 认证
Bearer Token（JWT）

#### 请求
```json
{
  "name": "string (1-100 chars)",       // 可选
  "description": "string | null",        // 可选，传 null 清空
  "isPinned": true,                      // 可选
  "sortOrder": 0,                        // 可选，>=0
  "icon": "string | null"                // 可选，传 null 清空
}
```

#### 响应 200
```json
{
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "name": "string",
    "description": "string | null",
    "isPinned": false,
    "sortOrder": 0,
    "icon": "string | null",
    "createdAt": "ISO8601",
    "updatedAt": "ISO8601"
  }
}
```

#### 错误码
| 码 | 场景 | 响应体 |
|----|------|--------|
| 400 | name 为空/超过 100 字符 | `{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }` |
| 400 | sortOrder 为负数 | `{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }` |
| 401 | 未认证 | 同上 |
| 403 | 用户不是知识库所有者 | `{ "error": { "code": "FORBIDDEN", "message": "..." } }` |
| 404 | 知识库不存在 | `{ "error": { "code": "NOT_FOUND", "message": "..." } }` |

---

### DELETE /api/knowledge-bases/:id

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
| 403 | 用户不是知识库所有者 | 同上 |
| 404 | 知识库不存在 | 同上 |

---

## 测试映射

| 场景 | 测试文件 | 测试用例 |
|------|----------|----------|
| 正常 - 列表 | `tests/issues/b-04-knowledge-base-api-testing/knowledge-base.spec.ts` | `AC-01: lists knowledge bases for current user` |
| 正常 - 创建 | `tests/issues/b-04-knowledge-base-api-testing/knowledge-base.spec.ts` | `AC-02: creates knowledge base with valid data` |
| 正常 - 更新 | `tests/issues/b-04-knowledge-base-api-testing/knowledge-base.spec.ts` | `AC-03: updates knowledge base with valid data` |
| 正常 - 删除 | `tests/issues/b-04-knowledge-base-api-testing/knowledge-base.spec.ts` | `AC-04: deletes knowledge base and returns confirmation` |
| 边界 - 空列表 | `tests/issues/b-04-knowledge-base-api-testing/knowledge-base.spec.ts` | `AC-05: returns empty array when no knowledge bases exist` |
| 边界 - 更新空 body | `tests/issues/b-04-knowledge-base-api-testing/knowledge-base.spec.ts` | `AC-06: updates with empty body returns unchanged` |
| 边界 - 设置 isPinned/sortOrder | `tests/issues/b-04-knowledge-base-api-testing/knowledge-base.spec.ts` | `AC-07: updates isPinned and sortOrder` |
| 参数错误 - name 为空 | `tests/issues/b-04-knowledge-base-api-testing/knowledge-base.spec.ts` | `AC-08: returns 400 when name is empty string` |
| 参数错误 - name 超长 | `tests/issues/b-04-knowledge-base-api-testing/knowledge-base.spec.ts` | `AC-09: returns 400 when name exceeds 100 chars` |
| 参数错误 - description 超长 | `tests/issues/b-04-knowledge-base-api-testing/knowledge-base.spec.ts` | `AC-10: returns 400 when description exceeds 500 chars` |
| 参数错误 - sortOrder 负数 | `tests/issues/b-04-knowledge-base-api-testing/knowledge-base.spec.ts` | `AC-11: returns 400 when sortOrder is negative` |
| 认证 - 无 JWT | `tests/issues/b-04-knowledge-base-api-testing/knowledge-base.spec.ts` | `AC-12: returns 401 without valid JWT` |
| 权限 - 非所有者 | `tests/issues/b-04-knowledge-base-api-testing/knowledge-base.spec.ts` | `AC-13: returns 403 for non-owner access` |
| 资源 - KB 不存在 | `tests/issues/b-04-knowledge-base-api-testing/knowledge-base.spec.ts` | `AC-14: returns 404 for non-existent knowledge base` |
| 隔离 - 多用户列表隔离 | `tests/issues/b-04-knowledge-base-api-testing/knowledge-base.spec.ts` | `AC-15: user A cannot see user B knowledge bases` |
