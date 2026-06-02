# API 规格：Folder/Session/Settings 模块级集成测试

## 端点清单

### FolderController

#### GET /api/knowledge-bases/:kbId/folders

##### 认证
Bearer Token（JwtAuthGuard）

##### 请求参数
- `kbId` (path): string — 知识库 ID
- `parentId` (query, optional): string | undefined — 父文件夹 ID。不传时返回根目录文件夹列表；传非法 UUID 时由 ZodValidationPipe 拦截返回 400

##### 响应 200
```json
[
  {
    "id": "string",
    "name": "string",
    "parentId": "string | null",
    "createdAt": "string (ISO 8601)"
  }
]
```

##### 错误码
| 码 | 场景 | 响应体 |
|----|------|--------|
| 401 | 未提供 Token | `{ "message": "Unauthorized", "statusCode": 401 }` |
| 403 | Token 无效 | `{ "message": "Forbidden", "statusCode": 403 }` |

---

#### POST /api/knowledge-bases/:kbId/folders

##### 认证
Bearer Token（JwtAuthGuard）

##### 请求体
```json
{
  "name": "string (1-100 chars)",
  "parentId": "string (uuid) | null | undefined"
}
```

##### 响应 201
```json
{
  "id": "string",
  "name": "string",
  "parentId": "string | null",
  "createdAt": "string (ISO 8601)"
}
```

##### 错误码
| 码 | 场景 | 响应体 |
|----|------|--------|
| 400 | name 为空或超过 100 字符 | `{ "message": "...", "statusCode": 400 }` |
| 400 | parentId 格式非法 | `{ "message": "...", "statusCode": 400 }` |
| 401 | 未提供 Token | `{ "message": "Unauthorized", "statusCode": 401 }` |

---

#### PATCH /api/knowledge-bases/:kbId/folders/:folderId

##### 认证
Bearer Token（JwtAuthGuard）

##### 请求体
```json
{
  "name": "string (1-100 chars)"
}
```

##### 响应 200
```json
{
  "id": "string",
  "name": "string",
  "parentId": "string | null",
  "createdAt": "string (ISO 8601)"
}
```

##### 错误码
| 码 | 场景 | 响应体 |
|----|------|--------|
| 400 | name 为空或超过 100 字符 | `{ "message": "...", "statusCode": 400 }` |
| 401 | 未提供 Token | `{ "message": "Unauthorized", "statusCode": 401 }` |
| 404 | 文件夹不存在 | `{ "message": "...", "statusCode": 404 }` |

---

#### DELETE /api/knowledge-bases/:kbId/folders/:folderId

##### 认证
Bearer Token（JwtAuthGuard）

##### 响应 200
```json
{
  "success": true
}
```

##### 错误码
| 码 | 场景 | 响应体 |
|----|------|--------|
| 401 | 未提供 Token | `{ "message": "Unauthorized", "statusCode": 401 }` |
| 404 | 文件夹不存在 | `{ "message": "...", "statusCode": 404 }` |

---

### SessionController

#### GET /api/sessions

##### 认证
Bearer Token（JwtAuthGuard）

##### 响应 200
```json
[
  {
    "id": "string",
    "title": "string",
    "createdAt": "string (ISO 8601)",
    "updatedAt": "string (ISO 8601)",
    "messageCount": 0,
    "summary": "string"
  }
]
```

##### 错误码
| 码 | 场景 | 响应体 |
|----|------|--------|
| 401 | 未提供 Token | `{ "message": "Unauthorized", "statusCode": 401 }` |

---

#### GET /api/sessions/:id

##### 认证
Bearer Token（JwtAuthGuard）

##### 响应 200
```json
{
  "id": "string",
  "title": "string",
  "createdAt": "string (ISO 8601)",
  "updatedAt": "string (ISO 8601)",
  "messageCount": 0,
  "summary": "string"
}
```

##### 错误码
| 码 | 场景 | 响应体 |
|----|------|--------|
| 401 | 未提供 Token | `{ "message": "Unauthorized", "statusCode": 401 }` |
| 404 | Session 不存在 | `{ "message": "...", "statusCode": 404 }` |

---

#### POST /api/sessions

##### 认证
Bearer Token（JwtAuthGuard）

##### 请求体
```json
{
  "title": "string (max 100, optional)",
  "provider": "string (max 50, optional)",
  "model": "string (max 50, optional)"
}
```

##### 响应 201
```json
{
  "id": "string",
  "title": "string",
  "createdAt": "string (ISO 8601)",
  "updatedAt": "string (ISO 8601)",
  "messageCount": 0,
  "summary": ""
}
```

##### 错误码
| 码 | 场景 | 响应体 |
|----|------|--------|
| 400 | title/provider/model 超过最大长度 | `{ "message": "...", "statusCode": 400 }` |
| 401 | 未提供 Token | `{ "message": "Unauthorized", "statusCode": 401 }` |

---

#### POST /api/sessions/:id/rename

##### 认证
Bearer Token（JwtAuthGuard）

##### 请求体
```json
{
  "title": "string (1-100 chars)"
}
```

##### 响应 200
```json
{
  "id": "string",
  "title": "string",
  "createdAt": "string (ISO 8601)",
  "updatedAt": "string (ISO 8601)",
  "messageCount": 0,
  "summary": "string"
}
```

##### 错误码
| 码 | 场景 | 响应体 |
|----|------|--------|
| 400 | title 为空或超过 100 字符 | `{ "message": "...", "statusCode": 400 }` |
| 401 | 未提供 Token | `{ "message": "Unauthorized", "statusCode": 401 }` |
| 404 | Session 不存在 | `{ "message": "...", "statusCode": 404 }` |

---

#### DELETE /api/sessions/:id

##### 认证
Bearer Token（JwtAuthGuard）

##### 响应 200
```json
{
  "success": true
}
```

##### 错误码
| 码 | 场景 | 响应体 |
|----|------|--------|
| 401 | 未提供 Token | `{ "message": "Unauthorized", "statusCode": 401 }` |
| 404 | Session 不存在 | `{ "message": "...", "statusCode": 404 }` |

---

### SettingsController

#### GET /api/settings

##### 认证
Bearer Token（JwtAuthGuard）

##### 响应 200
```json
{
  "providers": {
    "openai": { "apiKey": "string", "model": "string", "baseUrl": "string" },
    "claude": { "apiKey": "string", "model": "string", "baseUrl": "string" },
    "deepseek": { "apiKey": "string", "model": "string", "baseUrl": "string" },
    "custom": { "apiKey": "string", "model": "string", "baseUrl": "string" },
    "ollama": { "enabled": false, "url": "string", "model": "string" }
  },
  "embeddingProvider": {
    "provider": "string",
    "apiKey": "string",
    "model": "string",
    "baseUrl": "string"
  },
  "temperature": 0.7,
  "defaultChatProvider": "deepseek"
}
```

##### 错误码
| 码 | 场景 | 响应体 |
|----|------|--------|
| 401 | 未提供 Token | `{ "message": "Unauthorized", "statusCode": 401 }` |

---

#### POST /api/settings

##### 认证
Bearer Token（JwtAuthGuard）

##### 请求体
```json
{
  "providers": {
    "openai": { "apiKey": "string", "model": "string", "baseUrl": "string | empty" },
    "claude": { "apiKey": "string", "model": "string", "baseUrl": "string | empty" },
    "deepseek": { "apiKey": "string", "model": "string", "baseUrl": "string | empty" },
    "custom": { "apiKey": "string", "model": "string", "baseUrl": "string | empty" },
    "ollama": { "enabled": true, "url": "string (url)", "model": "string" }
  },
  "embeddingProvider": {
    "provider": "string",
    "apiKey": "string",
    "model": "string",
    "baseUrl": "string | empty"
  },
  "temperature": 0.7,
  "defaultChatProvider": "deepseek"
}
```

##### 响应 200
```json
{
  "providers": { ... },
  "embeddingProvider": { ... },
  "temperature": 0.7,
  "defaultChatProvider": "deepseek"
}
```

##### 错误码
| 码 | 场景 | 响应体 |
|----|------|--------|
| 400 | temperature 不在 0-2 范围 | `{ "message": "...", "statusCode": 400 }` |
| 400 | baseUrl 非法 URL 或指向内网 | `{ "message": "...", "statusCode": 400 }` |
| 400 | ollama.url 非法 URL 或指向内网（localhost 除外） | `{ "message": "...", "statusCode": 400 }` |
| 400 | defaultChatProvider 不在 providers key 中 | `{ "message": "...", "statusCode": 400 }` |
| 401 | 未提供 Token | `{ "message": "Unauthorized", "statusCode": 401 }` |

---

## 测试映射

| 场景 | 测试文件 | 测试用例 |
|------|----------|----------|
| Folder list | `tests/issues/b-06-folder-session-settings-testing/folder.spec.ts` | `AC-01: returns folder list for knowledge base` |
| Folder create | `tests/issues/b-06-folder-session-settings-testing/folder.spec.ts` | `AC-02: creates folder with valid data` |
| Folder create 400 | `tests/issues/b-06-folder-session-settings-testing/folder.spec.ts` | `AC-03: returns 400 for invalid folder name` |
| Folder update | `tests/issues/b-06-folder-session-settings-testing/folder.spec.ts` | `AC-04: updates folder name` |
| Folder update 404 | `tests/issues/b-06-folder-session-settings-testing/folder.spec.ts` | `AC-05: returns 404 for non-existent folder` |
| Folder delete | `tests/issues/b-06-folder-session-settings-testing/folder.spec.ts` | `AC-06: deletes folder` |
| Folder delete 404 | `tests/issues/b-06-folder-session-settings-testing/folder.spec.ts` | `AC-07: returns 404 for non-existent folder` |
| Session list | `tests/issues/b-06-folder-session-settings-testing/session.spec.ts` | `AC-08: returns session list ordered by updatedAt desc` |
| Session findOne | `tests/issues/b-06-folder-session-settings-testing/session.spec.ts` | `AC-09: returns single session` |
| Session create | `tests/issues/b-06-folder-session-settings-testing/session.spec.ts` | `AC-10: creates session with valid data` |
| Session rename | `tests/issues/b-06-folder-session-settings-testing/session.spec.ts` | `AC-11: renames session` |
| Session rename 400 | `tests/issues/b-06-folder-session-settings-testing/session.spec.ts` | `AC-12: returns 400 for empty title` |
| Session rename 404 | `tests/issues/b-06-folder-session-settings-testing/session.spec.ts` | `AC-13: returns 404 for non-existent session` |
| Session delete | `tests/issues/b-06-folder-session-settings-testing/session.spec.ts` | `AC-14: deletes session` |
| Session delete 404 | `tests/issues/b-06-folder-session-settings-testing/session.spec.ts` | `AC-15: returns 404 for non-existent session` |
| Settings get | `tests/issues/b-06-folder-session-settings-testing/settings.spec.ts` | `AC-16: returns default settings` |
| Settings save | `tests/issues/b-06-folder-session-settings-testing/settings.spec.ts` | `AC-17: saves and returns settings` |
| Settings Zod 400 | `tests/issues/b-06-folder-session-settings-testing/settings.spec.ts` | `AC-18: returns 400 for invalid temperature` |
| Settings Zod 400 | `tests/issues/b-06-folder-session-settings-testing/settings.spec.ts` | `AC-19: returns 400 for invalid baseUrl` |
| Settings Zod 400 | `tests/issues/b-06-folder-session-settings-testing/settings.spec.ts` | `AC-20: returns 400 for invalid defaultChatProvider` |
| Folder Auth 401 | `tests/issues/b-06-folder-session-settings-testing/folder.spec.ts` | `AC-21: returns 401 without token for folder endpoints` |
| Session Auth 401 | `tests/issues/b-06-folder-session-settings-testing/session.spec.ts` | `AC-22: returns 401 without token for session endpoints` |
| Settings Auth 401 | `tests/issues/b-06-folder-session-settings-testing/settings.spec.ts` | `AC-23: returns 401 without token for settings endpoints` |
