---
issue_id: q-04-password-transport-encryption
type: feature-spec
status: draft
summary: 客户端 RSA-OAEP 公钥加密密码后传输，服务端私钥解密后再 bcrypt 处理，杜绝密码明文出现在 HTTP 请求体中。
---

# Password Transport Encryption — 功能规格

> 对应 issue: `q-04-password-transport-encryption`
> 依赖: `i-09-nestjs-auth-system`

---

## 1. 目标

作为用户，我期望注册和登录时密码不以明文形式出现在 HTTP 请求体中。即使开发者工具 Network 面板或代理日志捕获到请求，密码内容不可读。

---

## 2. 范围

### 2.1 范围内

- RSA-4096 密钥对生成（服务端启动时），私钥仅存在于内存
- `GET /api/auth/public-key` — 返回 PEM 格式公钥
- `POST /api/auth/register` — 支持 `encryptedPassword` 字段
- `POST /api/auth/login` — 支持 `encryptedPassword` 字段
- 前端 `encryptPassword()` 工具函数（Web Crypto API, RSA-OAEP SHA-256）
- 公钥缓存（页面生命周期内复用，避免重复请求）

### 2.2 范围外

- HTTPS/TLS 配置
- 其他敏感字段加密（API Key 已有 AES-256-GCM）
- 密码重置、邮箱验证

---

## 3. 技术选型

| 组件 | 选型 | 说明 |
|------|------|------|
| 非对称算法 | RSA-4096 OAEP SHA-256 | 浏览器 Web Crypto API 原生支持 |
| 服务端加密库 | Node.js `crypto` | 零依赖，与现有 settings.service.ts 一致 |
| 密钥生命周期 | 服务端启动时生成，内存持有 | 无持久化需求，重启自动轮换 |
| 公钥格式 | PEM (SPKI) | 浏览器 `crypto.subtle.importKey` 可直接解析 |

---

## 4. 架构设计

### 4.1 数据流

```
[前端]                                [服务端]
   |                                      |
   |  GET /api/auth/public-key            |
   |------------------------------------->|
   |         PEM 公钥 (SPKI)              |
   |<-------------------------------------|
   |                                      |
   |  crypto.subtle.encrypt(RSA-OAEP)     |
   |  password → encryptedPassword (base64) |
   |                                      |
   |  POST /api/auth/register             |
   |  { email, encryptedPassword }        |
   |------------------------------------->|
   |                                      |  crypto.privateDecrypt()
   |                                      |  encryptedPassword → password
   |                                      |  bcrypt.hash(password, 12)
   |                                      |  → DB
   |         { user, accessToken, ... }   |
   |<-------------------------------------|
```

### 4.2 模块结构

```
packages/server/src/auth/
├── crypto/
│   └── password-encryption.service.ts   # RSA 密钥生成、解密
├── dto/
│   ├── register.dto.ts                  # 扩展 encryptedPassword 字段
│   └── login.dto.ts                     # 扩展 encryptedPassword 字段
├── auth.controller.ts                   # 新增 GET /public-key
└── auth.service.ts                      # register/login 先解密再 bcrypt

packages/webui/src/
├── utils/
│   └── password-encryption.ts           # encryptPassword() Web Crypto API
└── stores/
    └── auth.ts                          # 注册/登录前调用 encryptPassword()
```

---

## 5. 安全考量

- 私钥仅存在于 `PasswordEncryptionService` 内存中，不持久化、不写入日志
- RSA-4096 提供 ~128-bit 安全强度，匹配 AES-128
- OAEP 填充防选择密文攻击
- 每次服务重启生成全新密钥对，已加密的密码自动失效（用户需重新登录）
- 速率限制仍生效（5 req/min on register/login），防暴力破解

---

## 6. 验收标准

- [ ] `GET /api/auth/public-key` 返回 SPKI PEM 公钥
- [ ] 注册/登录接受 `encryptedPassword` 并正确解密 → bcrypt
- [ ] 前端 Web Crypto API 加密密码后发送
- [ ] 公钥缓存避免重复请求
- [ ] `pnpm type-check` 通过
- [ ] curl 全流程测试通过
