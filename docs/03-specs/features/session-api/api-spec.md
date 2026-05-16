# API Spec: 会话管理 (Session CRUD)

> 对应 issue: `b-03-session-api`
> 依赖: `i-02-prisma-setup`, `i-09-nestjs-auth-system`

---

## 端点清单

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| `GET` | `/api/sessions` | 会话列表（倒序，含消息数） | JWT |
| `GET` | `/api/sessions/:id` | 会话详情（含消息列表） | JWT |
| `POST` | `/api/sessions` | 创建会话 | JWT |
| `PATCH` | `/api/sessions/:id` | 重命名会话 | JWT |
| `DELETE` | `/api/sessions/:id` | 删除会话（级联消息） | JWT |

---

## 端点详情

### GET /api/sessions

返回当前用户会话列表，按 `updatedAt` 倒序。

**响应 200**
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "title": "新对话",
        "provider": "openai",
        "model": "gpt-4",
        "messageCount": 5,
        "createdAt": "2026-05-17T08:00:00.000Z",
        "updatedAt": "2026-05-17T09:00:00.000Z"
      }
    ]
  }
}
```

### GET /api/sessions/:id

**响应 200**
```json
{
  "data": {
    "id": "uuid",
    "title": "新对话",
    "provider": "openai",
    "model": "gpt-4",
    "messages": [
      { "id": "uuid", "role": "user", "content": "你好", "createdAt": "..." }
    ],
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

### POST /api/sessions

**请求**
```json
{ "title": "可选标题", "provider": "openai", "model": "gpt-4" }
```

**响应 201**
```json
{
  "data": {
    "id": "uuid",
    "title": "新对话",
    "provider": "openai",
    "model": "gpt-4",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

> `title` 默认为 `"新对话"`

### PATCH /api/sessions/:id

**请求**
```json
{ "title": "重命名" }
```

### DELETE /api/sessions/:id

**响应 200**
```json
{ "data": { "id": "uuid", "deleted": true } }
```

---

## DTO

```typescript
export const createSessionSchema = z.object({
  title: z.string().max(100).optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
})

export const updateSessionSchema = z.object({
  title: z.string().min(1).max(100),
})
```

---

## 错误码

| 状态码 | 场景 |
|--------|------|
| 401 | 未登录 |
| 403 | 非本会话所有者 |
| 404 | 会话不存在 |
