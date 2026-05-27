# q-17 API 规格

## 认证流程涉及的 API

### 注册流程
1. `GET /api/auth/public-key` — 获取 RSA 公钥
2. `POST /api/auth/register` — 提交注册（encryptedPassword 需 RSA-OAEP 加密）
3. `POST /api/auth/login` — 登录获取 Token
4. 前端存储 token 到 localStorage

### 登录流程
1. `GET /api/auth/public-key` — 获取 RSA 公钥
2. `POST /api/auth/login` — 提交登录
3. 响应包含 accessToken + refreshToken

### Token 刷新
1. `POST /api/auth/refresh` — 使用 refreshToken 获取新 accessToken

### 获取用户信息
1. `GET /api/auth/me` — 使用 accessToken 获取当前用户

## 知识库涉及的 API

### 知识库 CRUD
- `POST /api/knowledge-bases` — 创建
- `GET /api/knowledge-bases` — 列表
- `PATCH /api/knowledge-bases/:id` — 更新
- `DELETE /api/knowledge-bases/:id` — 删除

### 文档上传
- `POST /api/knowledge-bases/:kbId/documents/upload` — multipart/form-data
- `GET /api/knowledge-bases/:kbId/documents` — 列表
