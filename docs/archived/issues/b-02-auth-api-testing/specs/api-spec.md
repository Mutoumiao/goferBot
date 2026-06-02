# API 规格：AuthController 测试

## 端点

### GET /api/auth/public-key

#### 认证
无

#### 请求
无

#### 响应 200
```json
{
  "publicKey": "string (PEM format)",
  "algorithm": "RSA-OAEP",
  "hash": "SHA-256"
}
```

#### 错误码
无（此端点始终返回 200）

---

### POST /api/auth/register

#### 认证
无

#### 请求
```json
{
  "email": "string (valid email)",
  "encryptedPassword": "string (RSA-OAEP encrypted, base64)",
  "name": "string (optional, 1-50 chars)"
}
```

#### 响应 201
```json
{
  "user": {
    "id": "string (uuid)",
    "email": "string",
    "name": "string | null",
    "createdAt": "string (ISO 8601)"
  },
  "accessToken": "string (JWT)",
  "refreshToken": "string (JWT)"
}
```

#### 错误码
| 码 | 场景 | 响应体 |
|----|------|--------|
| 400 | Zod 验证失败（邮箱格式错误 / encryptedPassword 为空 / 过长） | `{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }` |
| 400 | 密码解密失败（RSA 解密异常） | `{ "error": { "code": "DECRYPT_FAILED", "message": "密码解密失败，请刷新页面后重试" } }` |
| 400 | 密码长度不在 6-100 之间 | `{ "error": { "code": "VALIDATION_ERROR", "message": "密码长度需在 6-100 个字符之间" } }` |
| 400 | 密码不含字母+数字 | `{ "error": { "code": "VALIDATION_ERROR", "message": "密码需同时包含字母和数字" } }` |
| 409 | 邮箱已存在 | `{ "error": { "code": "USER_EXISTS", "message": "该邮箱已被注册" } }` |
| 429 | 同一 IP 1 分钟内注册超过 5 次 | Throttler 返回 429 |

---

### POST /api/auth/login

#### 认证
无

#### 请求
```json
{
  "email": "string (valid email)",
  "encryptedPassword": "string (RSA-OAEP encrypted, base64)"
}
```

#### 响应 200
```json
{
  "user": {
    "id": "string (uuid)",
    "email": "string",
    "name": "string | null"
  },
  "accessToken": "string (JWT)",
  "refreshToken": "string (JWT)"
}
```

#### 错误码
| 码 | 场景 | 响应体 |
|----|------|--------|
| 400 | Zod 验证失败 | 同 register |
| 400 | 密码解密失败 / 长度 / 格式错误 | 同 register |
| 404 | 邮箱不存在或密码错误 | `{ "error": { "code": "AUTH_FAIL", "message": "邮箱或密码错误" } }` |
| 429 | 同一 IP 1 分钟内登录超过 5 次 | Throttler 返回 429 |

---

### POST /api/auth/refresh

#### 认证
无（需携带 refreshToken）

#### 请求
```json
{
  "refreshToken": "string (JWT)"
}
```

#### 响应 200
```json
{
  "accessToken": "string (JWT)",
  "refreshToken": "string (JWT)"
}
```

#### 错误码
| 码 | 场景 | 响应体 |
|----|------|--------|
| 401 | refreshToken 无效或已过期 | `{ "error": { "code": "INVALID_REFRESH_TOKEN", "message": "刷新令牌无效或已过期" } }` |
| 401 | token 类型不是 refresh | `{ "error": { "code": "INVALID_TOKEN_TYPE", "message": "无效的刷新令牌" } }` |
| 401 | 用户不存在 | `{ "error": { "code": "USER_NOT_FOUND", "message": "用户不存在" } }` |
| 429 | 同一 IP 1 分钟内刷新超过 10 次 | Throttler 返回 429 |

---

### POST /api/auth/logout

#### 认证
Bearer Token（JwtAuthGuard）

#### 请求
无 body

#### 响应 200
```json
{
  "success": true
}
```

#### 错误码
| 码 | 场景 | 响应体 |
|----|------|--------|
| 401 | 未携带 Authorization header | `{ "error": { "code": "AUTH_ERROR", "message": "..." } }` |
| 401 | Access Token 无效或已过期 | `{ "error": { "code": "AUTH_ERROR", "message": "..." } }` |

---

### GET /api/auth/me

#### 认证
Bearer Token（JwtAuthGuard）

#### 请求
无 body

#### 响应 200
```json
{
  "id": "string (uuid)",
  "email": "string",
  "name": "string | null",
  "createdAt": "string (ISO 8601)"
}
```

#### 错误码
| 码 | 场景 | 响应体 |
|----|------|--------|
| 401 | 未携带 Authorization header | 同 logout |
| 401 | Access Token 无效或已过期 | 同 logout |
| 401 | 用户已被删除（token 有效但用户不存在） | `{ "error": { "code": "USER_NOT_FOUND", "message": "用户不存在" } }` |

---

## 测试映射

| 场景 | 测试文件 | 测试用例 |
|------|----------|----------|
| public-key 正常返回 | `tests/issues/b-02-auth-api-testing/auth.controller.spec.ts` | `AC-01: GET /api/auth/public-key returns RSA public key` |
| register happy path | `tests/issues/b-02-auth-api-testing/auth.controller.spec.ts` | `AC-02: POST /api/auth/register creates user and returns tokens` |
| register 400 Zod | `tests/issues/b-02-auth-api-testing/auth.controller.spec.ts` | `AC-03: POST /api/auth/register returns 400 for invalid email` |
| register 400 decrypt | `tests/issues/b-02-auth-api-testing/auth.controller.spec.ts` | `AC-04: POST /api/auth/register returns 400 for decrypt failure` |
| register 400 password rule | `tests/issues/b-02-auth-api-testing/auth.controller.spec.ts` | `AC-05: POST /api/auth/register returns 400 for weak password` |
| register 409 | `tests/issues/b-02-auth-api-testing/auth.controller.spec.ts` | `AC-06: POST /api/auth/register returns 409 for duplicate email` |
| login happy path | `tests/issues/b-02-auth-api-testing/auth.controller.spec.ts` | `AC-07: POST /api/auth/login returns tokens for valid credentials` |
| login 400 | `tests/issues/b-02-auth-api-testing/auth.controller.spec.ts` | `AC-08: POST /api/auth/login returns 400 for invalid input` |
| login 401 | `tests/issues/b-02-auth-api-testing/auth.controller.spec.ts` | `AC-09: POST /api/auth/login returns 401 for wrong password` |
| refresh happy path | `tests/issues/b-02-auth-api-testing/auth.controller.spec.ts` | `AC-10: POST /api/auth/refresh returns new token pair` |
| refresh 401 | `tests/issues/b-02-auth-api-testing/auth.controller.spec.ts` | `AC-11: POST /api/auth/refresh returns 401 for invalid token` |
| logout happy path | `tests/issues/b-02-auth-api-testing/auth.controller.spec.ts` | `AC-12: POST /api/auth/logout returns success with valid token` |
| logout 401 | `tests/issues/b-02-auth-api-testing/auth.controller.spec.ts` | `AC-13: POST /api/auth/logout returns 401 without token` |
| me happy path | `tests/issues/b-02-auth-api-testing/auth.controller.spec.ts` | `AC-14: GET /api/auth/me returns current user` |
| me 401 | `tests/issues/b-02-auth-api-testing/auth.controller.spec.ts` | `AC-15: GET /api/auth/me returns 401 for invalid token` |
| E2E 完整链路 | `tests/issues/b-02-auth-api-testing/auth.e2e.spec.ts` | `AC-16: full auth flow (register → login → me → refresh → logout)` |
