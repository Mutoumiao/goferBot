---
issue_id: q-28
type: api-spec
status: draft
summary: AuthController、DocumentController、ChatController、KnowledgeBaseController 的模块级集成测试 API 规格。每个端点定义认证、请求、响应、错误码，并映射到测试用例。
---

# API 规格：PRD 第一批 Controller 模块级集成测试

> **PRD 来源**：`docs/prd/api-testing-prd.md` 第一批（第 221-231 行）
> **测试标准**：每个 Controller 必须覆盖 6 类场景 — happy path、Zod 验证失败、认证缺失/无效、资源不存在、唯一约束冲突、速率限制

---

## AuthController

### GET /api/auth/public-key

#### 认证
无

#### 请求
无

#### 响应 200
```json
{
  "data": {
    "publicKey": "-----BEGIN PUBLIC KEY-----\n...",
    "algorithm": "RSA-OAEP",
    "hash": "SHA-256"
  }
}
```

#### 错误码
| 码 | 场景 | 响应体 |
|----|------|--------|
| 429 | 请求过于频繁 | `{ "error": { "code": "THROTTLER", "message": "..." } }` |

#### 测试映射
| 场景 | 测试文件 | 测试用例 | 状态 |
|------|----------|----------|------|
| 正常获取 | `tests/integration/auth.controller.spec.ts` | `AC-01: returns public key with RSA-OAEP info` | ✅ 已实现 |
| 速率限制 | — | `AC-02: returns 429 when rate limit exceeded` | ⏭️ 移至第三批（ThrottlerGuard 全局测试）|

---

### POST /api/auth/register

#### 认证
无

#### 请求
```json
{
  "email": "user@example.com",
  "encryptedPassword": "base64(RSA-OAEP(plaintextPassword))",
  "name": "User Name"
}
```

#### 响应 201
```json
{
  "data": {
    "user": { "id": "...", "email": "...", "name": "..." },
    "accessToken": "jwt",
    "refreshToken": "jwt"
  }
}
```

#### 错误码
| 码 | 场景 | 响应体 |
|----|------|--------|
| 400 | email 格式无效 | `{ "error": { "code": "VALIDATION_ERROR", "message": "请输入有效的邮箱地址" } }` |
| 400 | encryptedPassword 为空 | `{ "error": { "code": "VALIDATION_ERROR", "message": "密码不能为空" } }` |
| 400 | 密码解密失败 | `{ "error": { "code": "DECRYPT_FAILED", "message": "密码解密失败..." } }` |
| 400 | 密码长度不足 | `{ "error": { "code": "VALIDATION_ERROR", "message": "密码长度需在 6-100 个字符之间" } }` |
| 400 | 密码不含字母和数字 | `{ "error": { "code": "VALIDATION_ERROR", "message": "密码需同时包含字母和数字" } }` |
| 409 | 邮箱已存在 | `{ "error": { "code": "USER_EXISTS", "message": "..." } }` |
| 429 | 请求过于频繁 | `{ "error": { "code": "THROTTLER", "message": "..." } }` |

#### 测试映射
| 场景 | 测试文件 | 测试用例 | 状态 |
|------|----------|----------|------|
| 正常注册 | `tests/integration/auth.controller.spec.ts` | `AC-03: creates user with valid data` | ✅ 已实现 |
| Zod 验证失败（email） | `tests/integration/auth.controller.spec.ts` | `AC-04: returns 400 for invalid email` | ✅ 已实现 |
| Zod 验证失败（password 为空） | `tests/integration/auth.controller.spec.ts` | `AC-05: returns 400 for empty password` | ⏳ plan 待补充 |
| 密码解密失败 | `tests/integration/auth.controller.spec.ts` | `AC-06: returns 400 for decrypt failure` | ⏳ plan 待补充 |
| 密码长度不足 | `tests/integration/auth.controller.spec.ts` | `AC-07: returns 400 for short password` | ⏳ plan 待补充 |
| 密码格式错误 | `tests/integration/auth.controller.spec.ts` | `AC-08: returns 400 for password without letter/digit` | ⏳ plan 待补充 |
| 邮箱已存在 | `tests/integration/auth.controller.spec.ts` | `AC-09: returns 409 for duplicate email` | ✅ 已实现 |
| 速率限制 | — | `AC-10: returns 429 when rate limit exceeded` | ⏭️ 移至第三批 |

---

### POST /api/auth/login

#### 认证
无

#### 请求
```json
{
  "email": "user@example.com",
  "encryptedPassword": "base64(RSA-OAEP(password))"
}
```

#### 响应 200
```json
{
  "data": {
    "user": { "id": "...", "email": "...", "name": "..." },
    "accessToken": "jwt",
    "refreshToken": "jwt"
  }
}
```

#### 错误码
| 码 | 场景 | 响应体 |
|----|------|--------|
| 400 | Zod 验证失败 | 同 register |
| 401 | 用户不存在 | `{ "error": { "code": "UNAUTHORIZED", "message": "..." } }` |
| 401 | 密码错误 | `{ "error": { "code": "UNAUTHORIZED", "message": "..." } }` |
| 403 | 账户被禁用 | `{ "error": { "code": "ACCOUNT_DISABLED", "message": "..." } }` |
| 429 | 请求过于频繁 | `{ "error": { "code": "THROTTLER", "message": "..." } }` |

#### 测试映射
| 场景 | 测试文件 | 测试用例 | 状态 |
|------|----------|----------|------|
| 正常登录 | `tests/integration/auth.controller.spec.ts` | `AC-11: returns tokens for valid credentials` | ✅ 已实现 |
| Zod 验证失败 | `tests/integration/auth.controller.spec.ts` | `AC-12: returns 400 for invalid input` | ⏳ plan 待补充 |
| 用户不存在 | `tests/integration/auth.controller.spec.ts` | `AC-13: returns 401 for non-existent user` | ✅ 已实现 |
| 密码错误 | `tests/integration/auth.controller.spec.ts` | `AC-14: returns 401 for wrong password` | ⏳ plan 待补充 |
| 账户被禁用 | `tests/integration/auth.controller.spec.ts` | `AC-15: returns 403 for disabled user` | ⏳ plan 待补充（空壳需实现）|
| 速率限制 | — | `AC-16: returns 429 when rate limit exceeded` | ⏭️ 移至第三批 |

---

### POST /api/auth/logout

#### 认证
Bearer Token

#### 请求
无

#### 响应 200
```json
{
  "data": { "success": true }
}
```

#### 错误码
| 码 | 场景 | 响应体 |
|----|------|--------|
| 401 | 未提供 token | `{ "error": { "code": "UNAUTHORIZED", "message": "..." } }` |
| 401 | token 无效 | `{ "error": { "code": "UNAUTHORIZED", "message": "..." } }` |

#### 测试映射
| 场景 | 测试文件 | 测试用例 | 状态 |
|------|----------|----------|------|
| 正常登出 | `tests/integration/auth.controller.spec.ts` | `AC-17: returns success for valid token` | ✅ 已实现 |
| 未认证 | `tests/integration/auth.controller.spec.ts` | `AC-18: returns 401 without token` | ✅ 已实现 |
| 无效 token | `tests/integration/auth.controller.spec.ts` | `AC-19: returns 401 for invalid token` | ⏳ plan 待补充 |

---

### POST /api/auth/refresh

#### 认证
无

#### 请求
```json
{
  "refreshToken": "jwt"
}
```

#### 响应 200
```json
{
  "data": {
    "accessToken": "new-jwt",
    "refreshToken": "new-jwt"
  }
}
```

#### 错误码
| 码 | 场景 | 响应体 |
|----|------|--------|
| 400 | refreshToken 为空 | `{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }` |
| 401 | token 类型错误（access token） | `{ "error": { "code": "UNAUTHORIZED", "message": "..." } }` |
| 401 | token 过期 | `{ "error": { "code": "UNAUTHORIZED", "message": "..." } }` |
| 401 | 用户不存在 | `{ "error": { "code": "UNAUTHORIZED", "message": "..." } }` |

#### 测试映射
| 场景 | 测试文件 | 测试用例 | 状态 |
|------|----------|----------|------|
| 正常刷新 | `tests/integration/auth.controller.spec.ts` | `AC-20: returns new tokens for valid refresh token` | ✅ 已实现 |
| Zod 验证失败 | `tests/integration/auth.controller.spec.ts` | `AC-21: returns 400 for empty refresh token` | ⏳ plan 待补充 |
| token 类型错误 | `tests/integration/auth.controller.spec.ts` | `AC-22: returns 401 for access token` | ⏳ plan 待补充 |
| token 过期 | `tests/integration/auth.controller.spec.ts` | `AC-23: returns 401 for expired token` | ✅ 已实现 |
| 用户不存在 | `tests/integration/auth.controller.spec.ts` | `AC-24: returns 401 when user not found` | ⏳ plan 待补充 |

---

### GET /api/auth/me

#### 认证
Bearer Token

#### 请求
无

#### 响应 200
```json
{
  "data": {
    "id": "...",
    "email": "...",
    "name": "...",
    "role": "USER"
  }
}
```

#### 错误码
| 码 | 场景 | 响应体 |
|----|------|--------|
| 401 | 未提供 token | `{ "error": { "code": "UNAUTHORIZED", "message": "..." } }` |
| 401 | token 无效 | `{ "error": { "code": "UNAUTHORIZED", "message": "..." } }` |
| 401 | 用户不存在 | `{ "error": { "code": "UNAUTHORIZED", "message": "..." } }` |

#### 测试映射
| 场景 | 测试文件 | 测试用例 | 状态 |
|------|----------|----------|------|
| 正常获取 | `tests/integration/auth.controller.spec.ts` | `AC-25: returns user profile for valid token` | ✅ 已实现 |
| 未认证 | `tests/integration/auth.controller.spec.ts` | `AC-26: returns 401 without token` | ✅ 已实现 |
| 无效 token | `tests/integration/auth.controller.spec.ts` | `AC-27: returns 401 for invalid token` | ⏳ plan 待补充 |
| 用户不存在 | `tests/integration/auth.controller.spec.ts` | `AC-28: returns 401 when user not found` | ⏳ plan 待补充 |

---

## DocumentController

### GET /api/knowledge-bases/:kbId/documents

#### 认证
Bearer Token

#### 请求
Query: `?folderId={uuid}`

#### 响应 200
```json
{
  "data": [
    { "id": "...", "name": "...", "mimeType": "...", "status": "..." }
  ]
}
```

#### 错误码
| 码 | 场景 | 响应体 |
|----|------|--------|
| 400 | folderId 格式非法 | `{ "error": { "code": "VALIDATION_ERROR", "message": "folderId 格式非法" } }` |
| 401 | 未认证 | `{ "error": { "code": "UNAUTHORIZED", "message": "..." } }` |
| 403 | 非 KB 所有者 | `{ "error": { "code": "FORBIDDEN", "message": "..." } }` |

#### 测试映射
| 场景 | 测试文件 | 测试用例 | 状态 |
|------|----------|----------|------|
| 正常列表 | `tests/integration/document.controller.spec.ts` | `AC-29: returns documents for KB owner` | ✅ 已实现 |
| folderId 格式错误 | `tests/integration/document.controller.spec.ts` | `AC-30: returns 400 for invalid folderId` | ⏳ plan 待补充 |
| 未认证 | `tests/integration/document.controller.spec.ts` | `AC-31: returns 401 without token` | ✅ 已实现 |
| 非所有者 | `tests/integration/document.controller.spec.ts` | `AC-32: returns 403 for non-owner` | ⏳ plan 待补充 |

---

### POST /api/knowledge-bases/:kbId/documents/upload

#### 认证
Bearer Token

#### 请求
`multipart/form-data`
- `file`: 文件内容
- `folderId` (可选): UUID

#### 响应 201
```json
{
  "data": {
    "id": "...",
    "name": "...",
    "storageKey": "...",
    "size": 100
  }
}
```

#### 错误码
| 码 | 场景 | 响应体 |
|----|------|--------|
| 400 | 未提供文件 | `{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }` |
| 401 | 未认证 | `{ "error": { "code": "UNAUTHORIZED", "message": "..." } }` |
| 403 | 非 KB 所有者 | `{ "error": { "code": "FORBIDDEN", "message": "..." } }` |
| 404 | KB 不存在 | `{ "error": { "code": "NOT_FOUND", "message": "..." } }` |
| 413 | 文件超过 50MB | `{ "error": { "code": "PAYLOAD_TOO_LARGE", "message": "文件超过 50MB 限制" } }` |
| 415 | 不支持的文件类型 | `{ "error": { "code": "UNSUPPORTED_TYPE", "message": "不支持的文件类型" } }` |
| 415 | 文件名含非法字符 | `{ "error": { "code": "UNSUPPORTED_TYPE", "message": "文件名包含非法字符" } }` |

#### 测试映射
| 场景 | 测试文件 | 测试用例 | 状态 |
|------|----------|----------|------|
| 正常上传 txt | `tests/integration/document.controller.spec.ts` | `AC-33: uploads txt file for KB owner` | ✅ 已实现 |
| 正常上传 md | `tests/integration/document.controller.spec.ts` | `AC-34: uploads md file for KB owner` | ⏳ plan 待补充 |
| 未提供文件 | `tests/integration/document.controller.spec.ts` | `AC-35: returns 400 without file` | ✅ 已实现 |
| 未认证 | `tests/integration/document.controller.spec.ts` | `AC-36: returns 401 without token` | ⏳ plan 待补充 |
| 非所有者 | `tests/integration/document.controller.spec.ts` | `AC-37: returns 403 for non-owner` | ⏳ plan 待补充 |
| KB 不存在 | `tests/integration/document.controller.spec.ts` | `AC-38: returns 404 for non-existent KB` | ⏳ plan 待补充 |
| 文件过大 | `tests/integration/document.controller.spec.ts` | `AC-39: returns 413 for file > 50MB` | ✅ 已实现（需验证 Fastify bodyLimit 影响）|
| 不支持的类型 | `tests/integration/document.controller.spec.ts` | `AC-40: returns 415 for unsupported type` | ✅ 已实现 |
| 非法文件名 | `tests/integration/document.controller.spec.ts` | `AC-41: returns 415 for path traversal filename` | ⏳ plan 待补充 |

---

### POST /api/knowledge-bases/:kbId/documents

#### 认证
Bearer Token

#### 请求
```json
{
  "name": "Document Name",
  "folderId": "uuid" // 可选
}
```

#### 响应 201
```json
{
  "data": {
    "id": "...",
    "name": "...",
    "kbId": "..."
  }
}
```

#### 错误码
| 码 | 场景 | 响应体 |
|----|------|--------|
| 400 | name 为空 | `{ "error": { "code": "VALIDATION_ERROR", "message": "文件名不能为空" } }` |
| 400 | folderId 格式非法 | `{ "error": { "code": "VALIDATION_ERROR", "message": "folderId 格式非法" } }` |
| 401 | 未认证 | `{ "error": { "code": "UNAUTHORIZED", "message": "..." } }` |
| 403 | 非 KB 所有者 | `{ "error": { "code": "FORBIDDEN", "message": "..." } }` |
| 404 | KB 不存在 | `{ "error": { "code": "NOT_FOUND", "message": "..." } }` |

#### 测试映射
| 场景 | 测试文件 | 测试用例 | 状态 |
|------|----------|----------|------|
| 正常创建 | `tests/integration/document.controller.spec.ts` | `AC-42: creates document for KB owner` | ✅ 已实现 |
| name 为空 | `tests/integration/document.controller.spec.ts` | `AC-43: returns 400 for empty name` | ✅ 已实现 |
| folderId 格式错误 | `tests/integration/document.controller.spec.ts` | `AC-44: returns 400 for invalid folderId` | ⏳ plan 待补充 |
| 未认证 | `tests/integration/document.controller.spec.ts` | `AC-45: returns 401 without token` | ⏳ plan 待补充 |
| 非所有者 | `tests/integration/document.controller.spec.ts` | `AC-46: returns 403 for non-owner` | ⏳ plan 待补充 |
| KB 不存在 | `tests/integration/document.controller.spec.ts` | `AC-47: returns 404 for non-existent KB` | ⏳ plan 待补充 |

---

### PATCH /api/knowledge-bases/:kbId/documents/:docId

#### 认证
Bearer Token

#### 请求
```json
{
  "name": "Updated Name",
  "folderId": "uuid" // 可选
}
```

#### 响应 200
```json
{
  "data": {
    "id": "...",
    "name": "Updated Name"
  }
}
```

#### 错误码
| 码 | 场景 | 响应体 |
|----|------|--------|
| 400 | name 为空 | `{ "error": { "code": "VALIDATION_ERROR", "message": "文件名不能为空" } }` |
| 401 | 未认证 | `{ "error": { "code": "UNAUTHORIZED", "message": "..." } }` |
| 403 | 非 KB 所有者 | `{ "error": { "code": "FORBIDDEN", "message": "..." } }` |
| 404 | KB 不存在 | `{ "error": { "code": "NOT_FOUND", "message": "..." } }` |
| 404 | 文档不存在 | `{ "error": { "code": "NOT_FOUND", "message": "..." } }` |
| 404 | 文档不在该 KB 中 | `{ "error": { "code": "NOT_FOUND", "message": "..." } }` |

#### 测试映射
| 场景 | 测试文件 | 测试用例 | 状态 |
|------|----------|----------|------|
| 正常更新 | `tests/integration/document.controller.spec.ts` | `AC-48: updates document for KB owner` | ✅ 已实现 |
| name 为空 | `tests/integration/document.controller.spec.ts` | `AC-49: returns 400 for empty name` | ⏳ plan 待补充 |
| 未认证 | `tests/integration/document.controller.spec.ts` | `AC-50: returns 401 without token` | ⏳ plan 待补充 |
| 非所有者 | `tests/integration/document.controller.spec.ts` | `AC-51: returns 403 for non-owner` | ⏳ plan 待补充 |
| KB 不存在 | `tests/integration/document.controller.spec.ts` | `AC-52: returns 404 for non-existent KB` | ⏳ plan 待补充 |
| 文档不存在 | `tests/integration/document.controller.spec.ts` | `AC-53: returns 404 for non-existent document` | ✅ 已实现 |
| 文档不在 KB 中 | `tests/integration/document.controller.spec.ts` | `AC-54: returns 404 when document not in KB` | ⏳ plan 待补充 |

---

### DELETE /api/knowledge-bases/:kbId/documents/:docId

#### 认证
Bearer Token

#### 请求
无

#### 响应 200
```json
{
  "data": { "deleted": true }
}
```

#### 错误码
| 码 | 场景 | 响应体 |
|----|------|--------|
| 401 | 未认证 | `{ "error": { "code": "UNAUTHORIZED", "message": "..." } }` |
| 403 | 非 KB 所有者 | `{ "error": { "code": "FORBIDDEN", "message": "..." } }` |
| 404 | KB 不存在 | `{ "error": { "code": "NOT_FOUND", "message": "..." } }` |
| 404 | 文档不存在 | `{ "error": { "code": "NOT_FOUND", "message": "..." } }` |

#### 测试映射
| 场景 | 测试文件 | 测试用例 | 状态 |
|------|----------|----------|------|
| 正常删除 | `tests/integration/document.controller.spec.ts` | `AC-55: deletes document for KB owner` | ✅ 已实现 |
| 未认证 | `tests/integration/document.controller.spec.ts` | `AC-56: returns 401 without token` | ⏳ plan 待补充 |
| 非所有者 | `tests/integration/document.controller.spec.ts` | `AC-57: returns 403 for non-owner` | ⏳ plan 待补充 |
| KB 不存在 | `tests/integration/document.controller.spec.ts` | `AC-58: returns 404 for non-existent KB` | ⏳ plan 待补充 |
| 文档不存在 | `tests/integration/document.controller.spec.ts` | `AC-59: returns 404 for non-existent document` | ⏳ plan 待补充 |

---

## ChatController

### POST /api/chat

#### 认证
Bearer Token

#### 请求
```json
{
  "message": "Hello",
  "sessionId": "uuid",
  "knowledgeBaseIds": ["uuid"],
  "config": {
    "provider": "openai",
    "model": "gpt-4",
    "baseUrl": "https://api.openai.com",
    "apiKey": "sk-..."
  }
}
```

#### 响应 200
SSE 流式响应：
```
data: {"content":"Hello","done":false}

data: {"content":"!","done":false}

data: {"done":true}
```

#### 错误码
| 码 | 场景 | 响应体 |
|----|------|--------|
| 400 | message 为空 | `{ "error": { "code": "VALIDATION_ERROR", "message": "消息不能为空" } }` |
| 400 | sessionId 格式非法 | `{ "error": { "code": "VALIDATION_ERROR", "message": "sessionId 格式不正确" } }` |
| 400 | config.provider 为空 | `{ "error": { "code": "VALIDATION_ERROR", "message": "provider 不能为空" } }` |
| 400 | baseUrl 不在白名单 | `{ "error": { "code": "VALIDATION_ERROR", "message": "baseUrl 不在白名单中..." } }` |
| 401 | 未认证 | `{ "error": { "code": "UNAUTHORIZED", "message": "..." } }` |

#### 测试映射
| 场景 | 测试文件 | 测试用例 | 状态 |
|------|----------|----------|------|
| 正常 SSE 流 | `tests/integration/chat.controller.spec.ts` | `AC-60: returns SSE stream for valid request` | ✅ 已实现 |
| message 为空 | `tests/integration/chat.controller.spec.ts` | `AC-61: returns 400 for empty message` | ✅ 已实现 |
| sessionId 格式错误 | `tests/integration/chat.controller.spec.ts` | `AC-62: returns 400 for invalid sessionId` | ✅ 已实现 |
| provider 为空 | `tests/integration/chat.controller.spec.ts` | `AC-63: returns 400 for empty provider` | ⏳ plan 待补充 |
| baseUrl 不在白名单 | `tests/integration/chat.controller.spec.ts` | `AC-64: returns 400 for disallowed baseUrl` | ⏳ plan 待补充 |
| 未认证 | `tests/integration/chat.controller.spec.ts` | `AC-65: returns 401 without token` | ✅ 已实现 |
| 客户端断开 | `tests/integration/chat.controller.spec.ts` | `AC-66: handles client disconnect gracefully` | ⏳ plan 待补充 |

> **注意**：ChatController 使用 `@BypassResponse()`，SSE 流直接写入 `reply.raw`，不经过 `ResponseInterceptor`。测试需验证 `Content-Type: text/event-stream` 和流格式。

---

## KnowledgeBaseController

### GET /api/knowledge-bases

#### 认证
Bearer Token

#### 请求
无

#### 响应 200
```json
{
  "data": [
    { "id": "...", "name": "...", "description": "...", "createdAt": "..." }
  ]
}
```

#### 错误码
| 码 | 场景 | 响应体 |
|----|------|--------|
| 401 | 未认证 | `{ "error": { "code": "UNAUTHORIZED", "message": "..." } }` |
| 401 | token 无效 | `{ "error": { "code": "UNAUTHORIZED", "message": "..." } }` |

#### 测试映射
| 场景 | 测试文件 | 测试用例 | 状态 |
|------|----------|----------|------|
| 正常列表 | `tests/integration/knowledge-base.controller.spec.ts` | `AC-67: returns KB list for authenticated user` | ✅ 已实现 |
| 未认证 | `tests/integration/knowledge-base.controller.spec.ts` | `AC-68: returns 401 without token` | ✅ 已实现 |
| 无效 token | `tests/integration/knowledge-base.controller.spec.ts` | `AC-69: returns 401 for invalid token` | ⏳ plan 待补充 |
| 权限隔离 | `tests/integration/knowledge-base.controller.spec.ts` | `AC-70: does not return other user's KBs` | ✅ 已实现 |

---

### POST /api/knowledge-bases

#### 认证
Bearer Token

#### 请求
```json
{
  "name": "My KB",
  "description": "Description",
  "icon": "📚"
}
```

#### 响应 201
```json
{
  "data": {
    "id": "...",
    "name": "My KB",
    "description": "Description",
    "icon": "📚"
  }
}
```

#### 错误码
| 码 | 场景 | 响应体 |
|----|------|--------|
| 400 | name 为空 | `{ "error": { "code": "VALIDATION_ERROR", "message": "知识库名称不能为空" } }` |
| 400 | name 超过 100 字符 | `{ "error": { "code": "VALIDATION_ERROR", "message": "名称过长" } }` |
| 400 | description 超过 500 字符 | `{ "error": { "code": "VALIDATION_ERROR", "message": "描述过长" } }` |
| 401 | 未认证 | `{ "error": { "code": "UNAUTHORIZED", "message": "..." } }` |

#### 测试映射
| 场景 | 测试文件 | 测试用例 | 状态 |
|------|----------|----------|------|
| 正常创建 | `tests/integration/knowledge-base.controller.spec.ts` | `AC-71: creates KB with valid data` | ✅ 已实现 |
| name 为空 | `tests/integration/knowledge-base.controller.spec.ts` | `AC-72: returns 400 for empty name` | ✅ 已实现 |
| name 过长 | `tests/integration/knowledge-base.controller.spec.ts` | `AC-73: returns 400 for name > 100 chars` | ⏳ plan 待补充 |
| description 过长 | `tests/integration/knowledge-base.controller.spec.ts` | `AC-74: returns 400 for description > 500 chars` | ⏳ plan 待补充 |
| 未认证 | `tests/integration/knowledge-base.controller.spec.ts` | `AC-75: returns 401 without token` | ✅ 已实现 |

---

### PATCH /api/knowledge-bases/:id

#### 认证
Bearer Token

#### 请求
```json
{
  "name": "Updated Name",
  "description": "Updated Description",
  "isPinned": true,
  "sortOrder": 1
}
```

#### 响应 200
```json
{
  "data": {
    "id": "...",
    "name": "Updated Name"
  }
}
```

#### 错误码
| 码 | 场景 | 响应体 |
|----|------|--------|
| 400 | name 为空 | `{ "error": { "code": "VALIDATION_ERROR", "message": "知识库名称不能为空" } }` |
| 400 | sortOrder 为负数 | `{ "error": { "code": "VALIDATION_ERROR", "message": "排序值不能为负数" } }` |
| 401 | 未认证 | `{ "error": { "code": "UNAUTHORIZED", "message": "..." } }` |
| 403 | 非所有者 | `{ "error": { "code": "FORBIDDEN", "message": "..." } }` |
| 404 | KB 不存在 | `{ "error": { "code": "NOT_FOUND", "message": "..." } }` |

#### 测试映射
| 场景 | 测试文件 | 测试用例 | 状态 |
|------|----------|----------|------|
| 正常更新 | `tests/integration/knowledge-base.controller.spec.ts` | `AC-76: updates KB for owner` | ✅ 已实现 |
| name 为空 | `tests/integration/knowledge-base.controller.spec.ts` | `AC-77: returns 400 for empty name` | ⏳ plan 待补充 |
| sortOrder 负数 | `tests/integration/knowledge-base.controller.spec.ts` | `AC-78: returns 400 for negative sortOrder` | ⏳ plan 待补充 |
| 未认证 | `tests/integration/knowledge-base.controller.spec.ts` | `AC-79: returns 401 without token` | ⏳ plan 待补充 |
| 非所有者 | `tests/integration/knowledge-base.controller.spec.ts` | `AC-80: returns 403 for non-owner` | ✅ 已实现 |
| KB 不存在 | `tests/integration/knowledge-base.controller.spec.ts` | `AC-81: returns 404 for non-existent KB` | ✅ 已实现 |

---

### DELETE /api/knowledge-bases/:id

#### 认证
Bearer Token

#### 请求
无

#### 响应 200
```json
{
  "data": { "deleted": true }
}
```

#### 错误码
| 码 | 场景 | 响应体 |
|----|------|--------|
| 401 | 未认证 | `{ "error": { "code": "UNAUTHORIZED", "message": "..." } }` |
| 403 | 非所有者 | `{ "error": { "code": "FORBIDDEN", "message": "..." } }` |
| 404 | KB 不存在 | `{ "error": { "code": "NOT_FOUND", "message": "..." } }` |

#### 测试映射
| 场景 | 测试文件 | 测试用例 | 状态 |
|------|----------|----------|------|
| 正常删除 | `tests/integration/knowledge-base.controller.spec.ts` | `AC-82: deletes KB for owner` | ✅ 已实现 |
| 未认证 | `tests/integration/knowledge-base.controller.spec.ts` | `AC-83: returns 401 without token` | ⏳ plan 待补充 |
| 非所有者 | `tests/integration/knowledge-base.controller.spec.ts` | `AC-84: returns 403 for non-owner` | ⏳ plan 待补充 |
| KB 不存在 | `tests/integration/knowledge-base.controller.spec.ts` | `AC-85: returns 404 for non-existent KB` | ✅ 已实现 |
