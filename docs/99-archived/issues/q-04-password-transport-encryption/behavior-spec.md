---
issue_id: q-04-password-transport-encryption
type: behavior-spec
status: draft
summary: 定义密码加密传输的端到端行为：公钥获取、缓存、加密、解密、错误恢复。
---

# Password Transport Encryption — 行为规格

> 对应 issue: `q-04-password-transport-encryption`

---

## 1. 公钥获取流程

```
[用户打开登录/注册页面]
        ↓
[检查公钥缓存是否存在]
  ├── 存在 → 直接使用
  └── 不存在 → GET /api/auth/public-key
                    ↓
              [缓存公钥到模块变量]
                    ↓
              [使用公钥加密]
```

**规则**：
- 公钥缓存在 JS 模块作用域，页面刷新后自动清空
- 不存入 localStorage/sessionStorage（无安全收益）

---

## 2. 注册流程

```
[用户填写邮箱、密码、确认密码]
        ↓
[前端表单校验：邮箱格式、密码长度≥8、含字母+数字、两次密码一致]
        ↓
[获取公钥（→ 1.）]
        ↓
[encryptPassword(publicKey, rawPassword)]
        ↓
[POST /api/auth/register { email, encryptedPassword, name }]
        ↓
[服务端：privateDecrypt(encryptedPassword) → bcrypt.hash → 存入 DB]
        ↓
[返回 { user, accessToken, refreshToken }]
```

**错误恢复**：
```
POST /api/auth/register
  ├── 201 → 注册成功，跳转 /app/chat
  ├── 400 DECRYPT_FAILED → 清空公钥缓存 → 重新获取公钥 → 重试 1 次
  ├── 409 USER_EXISTS → 提示"该邮箱已被注册"
  ├── 429 → 提示"操作过于频繁，请稍后再试"
  └── 网络错误 → 提示"网络异常，请稍后重试"
```

---

## 3. 登录流程

```
[用户填写邮箱、密码]
        ↓
[前端表单校验：邮箱格式、密码非空]
        ↓
[获取公钥（→ 1.）]
        ↓
[encryptPassword(publicKey, rawPassword)]
        ↓
[POST /api/auth/login { email, encryptedPassword }]
        ↓
[服务端：privateDecrypt(encryptedPassword) → bcrypt.compare]
        ↓
[返回 { user, accessToken, refreshToken }]
```

**错误恢复**：与注册相同，`DECRYPT_FAILED` 时清缓存 → 重试 1 次。

---

## 4. 解密失败场景

| 场景 | 原因 | 客户端行为 |
|------|------|------------|
| 服务重启 | 密钥对已更新 | 清缓存 → 重新获取公钥 → 重试 |
| 客户端使用过期公钥 | 页面长时间打开 | 同上 |
| 数据损坏 | 网络传输错误 | 提示用户重试 |
| 恶意篡改 | 中间人修改密文 | 解密失败，提示重试 |

**后端解密失败不暴露详细信息**，统一返回 `DECRYPT_FAILED`。

---

## 5. 速率限制兼容

- `GET /api/auth/public-key` 不受速率限制（公开端点，低频调用）
- `POST /api/auth/register` 和 `POST /api/auth/login` 保持 5 req/min
- `DECRYPT_FAILED` 不计入速率限制计数（避免消耗用户配额）

---

## 6. 浏览器兼容性

`crypto.subtle.encrypt` (Web Crypto API) 要求安全上下文（HTTPS 或 localhost）。

| 环境 | 可用性 |
|------|--------|
| `http://localhost` | ✅ 浏览器视为安全上下文 |
| `http://127.0.0.1` | ✅ 同上 |
| `http://<production>` | ❌ 需要 HTTPS（范围外，生产部署配置 TLS） |
