# q-16 API 规格

## E2E 测试涉及的 API 端点

### 认证
- `GET /api/auth/public-key` — 获取 RSA 公钥
- `POST /api/auth/register` — 注册
- `POST /api/auth/login` — 登录
- `POST /api/auth/refresh` — 刷新 Token
- `GET /api/auth/me` — 获取当前用户

### 知识库
- `GET /api/knowledge-bases` — 列表
- `POST /api/knowledge-bases` — 创建
- `PATCH /api/knowledge-bases/:id` — 更新
- `DELETE /api/knowledge-bases/:id` — 删除

### 文档
- `GET /api/knowledge-bases/:kbId/documents` — 列表
- `POST /api/knowledge-bases/:kbId/documents/upload` — 上传
- `DELETE /api/knowledge-bases/:kbId/documents/:docId` — 删除

### 会话
- `GET /api/sessions` — 列表
- `POST /api/sessions` — 创建
- `GET /api/sessions/:id` — 详情
- `POST /api/sessions/:id/rename` — 重命名
- `DELETE /api/sessions/:id` — 删除

### 聊天
- `POST /api/chat` — SSE 流式聊天

### 设置
- `GET /api/settings` — 获取
- `POST /api/settings` — 保存

### 健康检查
- `GET /api/health` — 服务健康

## Fixture API 封装

```typescript
// fixtures/api-client.ts
interface ApiClient {
  register(email: string, password: string, name: string): Promise<AuthResponse>
  login(email: string, password: string): Promise<AuthResponse>
  createKB(name: string): Promise<KnowledgeBase>
  uploadDocument(kbId: string, file: File): Promise<Document>
  createSession(title?: string): Promise<Session>
  sendChat(message: string, sessionId: string, config: LLMConfig): Promise<Response>
  getSettings(): Promise<Settings>
  saveSettings(settings: Settings): Promise<void>
}
```
