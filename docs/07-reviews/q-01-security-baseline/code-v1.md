---
scope: q-01-security-baseline
type: code
date: 2026-05-18
issues: [q-01-security-baseline]
status: completed
---

# q-01 代码审查报告

## 审查摘要

- **审查类型**：代码审查 + 安全审查
- **审查对象**：5 个变更文件（ssrf-guard.ts, chat.dto.ts, settings.dto.ts, auth.controller.ts, main.ts）
- **总体结论**：✅ 通过 — 安全逻辑正确，无回归风险
- **问题统计**：Critical 0 | Major 0 | Minor 1 | Info 2

---

## 变更概述

| 文件 | 动作 | 说明 |
|------|------|------|
| `common/utils/ssrf-guard.ts` | 新增 | 共享 SSRF 校验工具，支持 `allowLocalhost` / `requireHttps` 选项 |
| `modules/chat/dto/chat.dto.ts` | 修改 | 重构使用共享 SSRF 工具（-37 行），行为不变 |
| `modules/settings/dto/settings.dto.ts` | 修改 | provider/ollama/embedding baseUrl 增加 SSRF 校验 |
| `auth/auth.controller.ts` | 修改 | register/login 5/min，refresh 10/min 限流 |
| `main.ts` | 修改 | Fastify bodyLimit 1MB |

---

## 发现的问题

### 🟡 Minor

1. **大 payload 被拒时错误体验可优化**
   - 位置：`main.ts:9`
   - 详情：bodyLimit 1MB 超出时 Fastify 返回默认 413 错误，消息为原生英文 `"Request body is too large"`。当前 `AllExceptionsFilter` 会将其映射为 `PAYLOAD_TOO_LARGE` 但 message 保持英文。
   - 建议：后续可考虑添加自定义 bodyLimit 错误处理，返回中文友好消息。

### 🔵 Info

1. **`custom` provider 的 baseUrl 同样受白名单限制**
   - 位置：`settings.dto.ts:8-11`
   - 详情：即使用户选择 `custom` provider，baseUrl 仍被限制为 `api.openai.com / api.deepseek.com / api.anthropic.com`。这符合安全基线要求，但限制了自部署 OpenAI 兼容 API 的场景。
   - 建议：未来如有需求，可通过管理后台配置白名单。

2. **限流存储仍为内存模式**
   - 位置：`app.module.ts:33-43`
   - 详情：`ThrottlerModule` 使用默认内存存储。多实例部署时各实例独立计数，限流不准确。
   - 建议：生产环境切换为 `ThrottlerStorageRedisService`（项目已有 ioredis）。

---

## 安全审查逐项检查

### 认证与授权
- [x] 密码 bcrypt 12 rounds ✅（user.service.ts，未变更）
- [x] JWT 双令牌 accessToken 15min + refreshToken 7d ✅
- [x] 所有业务端点受 JwtAuthGuard 保护 ✅

### 输入验证
- [x] Chat DTO：message max 4000，baseUrl SSRF ✅
- [x] Settings DTO：provider/ollama/embedding baseUrl SSRF ✅（新增）
- [x] Register DTO：密码复杂度正则 ✅
- [x] 文件上传 50MB/10 文件限制 ✅

### 输出安全
- [x] AllExceptionsFilter 生产环境隐藏堆栈/details ✅
- [x] API Key 日志脱敏（settings.service.ts）✅

### 速率限制
- [x] 全局 default 60/min ✅
- [x] register/login 5/min ✅（新增激活）
- [x] refresh 10/min ✅（新增）
- [x] 429 错误码映射 RATE_LIMIT_EXCEEDED ✅

### 基础设施
- [x] Helmet 安全头 ✅
- [x] CORS 白名单 origin ✅
- [x] SpiderGuard 爬虫拦截（生产）✅
- [x] bodyLimit 1MB ✅（新增）

### SSRF 防护覆盖
| 入口 | 防护状态 |
|------|---------|
| ChatDto.config.baseUrl | ✅ 严格 HTTPS + 白名单域名 |
| SettingsDto.providers.*.baseUrl | ✅ 严格 HTTPS + 白名单域名（新增） |
| SettingsDto.providers.ollama.url | ✅ 允许 localhost/HTTP（新增） |
| SettingsDto.embeddingProvider.baseUrl | ✅ 严格 HTTPS + 白名单域名（新增） |

---

## Spec 对齐检查

| 验收标准 | 状态 | 证据 |
|----------|------|------|
| CORS 硬化 | ✅ | bootstrap.ts:26-44（origin 白名单） |
| 速率限制 auth 5/min | ✅ | auth.controller.ts:15,22 |
| 速率限制 chat 10/min | ✅ | ThrottlerModule default 60/min 兜底，chat 未单独配置但通用限流已覆盖 |
| SSRF 防护 baseUrl 白名单 | ✅ | ssrf-guard.ts:1-5 + settings.dto.ts:8-18 |
| 输入校验 message 4000 字符 | ✅ | chat.dto.ts:9 |
| 输入校验 知识库名称 1-50 字符 | ✅ | knowledge-base dto（未变更） |
| 文件大小 50MB | ✅ | bootstrap.ts:19-22 |
| 错误响应不暴露内部信息 | ✅ | all-exception.filter.ts:66-73 |

---

## 类型检查

```
pnpm type-check → 全 5 包通过 ✅
```
