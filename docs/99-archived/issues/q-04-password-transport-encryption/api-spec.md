---
issue_id: q-04-password-transport-encryption
type: api-spec
status: draft
summary: 定义 GET /api/auth/public-key 端点及 register/login 端点的 encryptedPassword 扩展字段。
---

# Password Transport Encryption — API 规格

> 对应 issue: `q-04-password-transport-encryption`
> 关联: `i-09-nestjs-auth-system`

---

## 1. 基础信息

- **Base URL**: `http://localhost:3000`
- **Content-Type**: `application/json`
- **认证方式**: public-key 端点公开，register/login 公开（速率限制 5/min）

---

## 2. 新增端点

### 2.1 GET /api/auth/public-key

获取 RSA 公钥（SPKI PEM 格式），用于前端加密密码。

#### Request

```http
GET /api/auth/public-key HTTP/1.1
```

#### Success Response — 200 OK

```json
{
  "publicKey": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...\n-----END PUBLIC KEY-----",
  "algorithm": "RSA-OAEP",
  "hash": "SHA-256"
}
```

#### Notes

- 无需认证，不受速率限制
- 公钥在服务生命周期内不变（重启后轮换）
- 前端应缓存公钥，避免每次表单提交前重复请求

---

## 3. 修改端点

### 3.1 POST /api/auth/register

#### Request (新)

```http
POST /api/auth/register HTTP/1.1
Content-Type: application/json

{
  "email": "user@example.com",
  "encryptedPassword": "<base64 RSA-OAEP encrypted>",
  "name": "用户昵称"
}
```

#### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `email` | string | ✅ | 邮箱地址 |
| `encryptedPassword` | string | ✅ | RSA-OAEP 加密后的 base64 密码 |
| `name` | string | 否 | 用户昵称（1-50 字符） |

#### Success Response — 201 Created

```json
{
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "用户昵称",
      "createdAt": "2026-05-18T00:00:00.000Z"
    },
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi..."
  }
}
```

#### Error Responses

| 状态码 | 响应体 |
|--------|--------|
| 400 | `{ "error": { "code": "VALIDATION_ERROR", "message": "请求参数校验失败" } }` |
| 400 | `{ "error": { "code": "DECRYPT_FAILED", "message": "密码解密失败，请刷新页面后重试" } }` |
| 409 | `{ "error": { "code": "USER_EXISTS", "message": "该邮箱已被注册" } }` |
| 429 | `{ "error": { "code": "RATE_LIMIT_EXCEEDED", "message": "请求过于频繁" } }` |

### 3.2 POST /api/auth/login

#### Request (新)

```http
POST /api/auth/login HTTP/1.1
Content-Type: application/json

{
  "email": "user@example.com",
  "encryptedPassword": "<base64 RSA-OAEP encrypted>"
}
```

#### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `email` | string | ✅ | 邮箱地址 |
| `encryptedPassword` | string | ✅ | RSA-OAEP 加密后的 base64 密码 |

#### Success Response — 200 OK

```json
{
  "data": {
    "user": { "id": "uuid", "email": "user@example.com", "name": "..." },
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi..."
  }
}
```

#### Error Responses

| 状态码 | 响应体 |
|--------|--------|
| 400 | `{ "error": { "code": "VALIDATION_ERROR", "message": "请求参数校验失败" } }` |
| 400 | `{ "error": { "code": "DECRYPT_FAILED", "message": "密码解密失败，请刷新页面后重试" } }` |
| 401 | `{ "error": { "code": "AUTH_FAIL", "message": "邮箱或密码错误" } }` |
| 429 | `{ "error": { "code": "RATE_LIMIT_EXCEEDED", "message": "请求过于频繁" } }` |

---

## 4. 新增错误码

| Code | 含义 |
|------|------|
| `DECRYPT_FAILED` | RSA 解密失败（密钥过期/客户端用错公钥/数据损坏） |

客户端收到 `DECRYPT_FAILED` 应：重新获取公钥 → 重新加密 → 重试一次。
