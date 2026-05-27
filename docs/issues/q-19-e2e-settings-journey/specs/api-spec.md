# q-19 API 规格

## 设置涉及的 API

### 设置 CRUD
- `GET /api/settings` — 获取用户设置
- `POST /api/settings` — 保存用户设置

### 设置数据结构
```typescript
interface Settings {
  providers: {
    openai: { apiKey: string; model: string; baseUrl: string }
    claude: { apiKey: string; model: string; baseUrl: string }
    deepseek: { apiKey: string; model: string; baseUrl: string }
    custom: { apiKey: string; model: string; baseUrl: string }
    ollama: { enabled: boolean; url: string; model: string }
  }
  embeddingProvider: { provider: string; apiKey: string; model: string; baseUrl: string }
  temperature: number
  defaultChatProvider: string
}
```

## 用户旅程涉及的 API（跨模块）

### 入职旅程
1. `POST /api/auth/register` — 注册
2. `POST /api/auth/login` — 登录
3. `POST /api/knowledge-bases` — 创建 KB
4. `POST /api/knowledge-bases/:kbId/documents/upload` — 上传文档
5. `POST /api/sessions` — 创建会话
6. `POST /api/chat` — 发送消息

## 前端路由

- `/app/settings` — 设置页面
- `/app/chat` — 聊天页面
- `/app/knowledge-base` — 知识库页面
