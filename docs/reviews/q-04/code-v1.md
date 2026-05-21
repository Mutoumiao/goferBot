---
scope: q-04
type: code
date: 2026-05-18
issues: [q-04-password-transport-encryption]
status: completed
summary: 代码+安全+Spec对齐审查。发现 Major 2、Minor 2、Info 2，全部已修复。最终验证通过。
---

# q-04 密码传输加密 — 审查报告 v1

> **审查类型**：综合审查（代码 + 安全 + Spec 对齐）
> **审查对象**：13 个文件（7 新建 + 6 修改）
> **审查者**：kb-review skill

---

## 审查摘要

- **总体结论**：✅ 通过（修复后）
- **问题统计**：Critical 0 | Major 2（已修复 2）| Minor 2（已修复 2）| Info 2

## 发现的问题

### 🟠 Major

1. **DTO 丢失服务端密码复杂度校验** ✅ 已修复
   - 位置：`packages/server/src/auth/dto/register.dto.ts:6`
   - 详情：旧 DTO 校验 `min(6)`、`max(100)`、正则 `/(?=.*[a-zA-Z])(?=.*\d)/`。改为 `encryptedPassword` 后丢失。
   - 修复：提取 `decryptAndValidate()` 方法，解密后校验密码强度和长度。
   - 修复提交：待提交

2. **前端 pemToArrayBuffer 无错误处理** ✅ 已修复
   - 位置：`packages/webui/src/utils/password-encryption.ts:11-22`
   - 详情：畸形 PEM 导致 `crypto.subtle.importKey` 抛错无友好提示。
   - 修复：新增 `PasswordEncryptionError` 类，`encryptPassword` 包裹 try-catch。

### 🟡 Minor

3. **Controller 解密逻辑重复** ✅ 已修复
   - 位置：`auth.controller.ts:31-39` 和 `:47-55`
   - 修复：提取 `decryptAndValidate()` 私有方法。

4. **Zod schema 无 encryptedPassword 大小上限** ✅ 已修复
   - 位置：`dto/register.dto.ts:6`, `dto/login.dto.ts:6`
   - 修复：添加 `.max(4096)`。

### 🔵 Info

5. **generateKeyPairSync 阻塞启动** — 不修复
   - 启动时一次性操作，~200ms，可接受。生产可考虑异步版本。

6. **防御性 null 检查** — 不修复
   - `PasswordEncryptionService` 中 null 检查理论不会触发，符合项目"不为不可能的情况加错误处理"规范，保留。

---

## Spec 对齐检查

| 验收标准 | 状态 | 证据 |
|----------|------|------|
| `GET /api/auth/public-key` 返回 PEM | ✅ | curl 200 + SPKI PEM |
| 注册接受 `encryptedPassword` | ✅ | curl 201 |
| 登录接受 `encryptedPassword` | ✅ | curl 200 + token |
| 解密失败返回 `DECRYPT_FAILED` | ✅ | curl 400 + code |
| 服务端密码校验（长度+组合） | ✅ | 弱密码 → 400 VALIDATION_ERROR |
| 前端 Web Crypto 加密 | ✅ | `password-encryption.ts` |
| 公钥缓存 | ✅ | 模块级 `cachedPublicKey` |
| `DECRYPT_FAILED` 重试 | ✅ | auth store isRetry 机制 |
| `pnpm type-check` 通过 | ✅ | server + webui |
| 速率限制保持 | ✅ | `@Throttle` 不变 |
| oversized payload 拒绝 | ✅ | 5000 chars → 422 |

---

## 验证记录

```
1. Weak password (too short)    → 400 VALIDATION_ERROR ✅
2. Password without letters     → 400 VALIDATION_ERROR ✅
3. Valid password               → 201 ✅
4. Login                        → 200 + token ✅
5. Oversized encryptedPassword  → 422 VALIDATION_ERROR ✅
```
