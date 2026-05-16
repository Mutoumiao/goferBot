状态: needs-triage
分类: security

## 要构建的内容

为所有 Sidecar API 建立安全基线：CORS 硬化、速率限制、输入校验、SSRF 防护。这些必须在认证上线前就位。

## 规格引用

- 安全审计报告: 2026-05-16 (gstack-cso)
- PRD: docs/01-prd/v2-cloud-native.md

## 验收标准

### CORS 硬化
- [ ] `Access-Control-Allow-Origin` 从 `*` 改为仅允许 Tauri WebView origin（`http://localhost:1420`）
- [ ] 或完全移除非必要 CORS 头（同机 IPC 不需要 CORS）
- [ ] 如果保留 CORS，`Access-Control-Allow-Methods` 仅列出实际使用的 method

### 速率限制
- [ ] 引入 `hono-rate-limiter` 中间件
- [ ] `/chat` 端点限制：10 req/min（防止 API Key 滥用）
- [ ] `/api/knowledge-bases/:id/files` 上传限制：30 req/min
- [ ] 通用端点限制：60 req/min

### SSRF 防护
- [ ] `streamChatCompletion` 中校验 `baseUrl`，仅允许已知 provider 白名单
- [ ] 白名单：OpenAI (`api.openai.com`)、DeepSeek (`api.deepseek.com`)、Claude (`api.anthropic.com`)、Ollama (`localhost:11434`)
- [ ] 拒绝内网地址（169.254.x.x、10.x.x.x、192.168.x.x）除 localhost 外

### 输入校验
- [ ] 消息 content 长度上限 4000 字符（后端校验）
- [ ] 知识库名称长度 1-50 字符，过滤特殊字符
- [ ] 上传文件大小上限 50MB（后端校验，413 状态码）
- [ ] 文件名特殊字符过滤（防路径穿越 + 特殊符号）

### 响应安全
- [ ] 错误响应不暴露内部路径/堆栈信息
- [ ] 生产环境禁用 Hono 默认错误详情

## 阻塞于

- i-00-core-interfaces（需要 IAuthProvider 定义完成后才能统一错误码）

## 范围外

- WAF/IDS 级别防护
- DDoS 防护

## Agent 简报

**分类：** security
**摘要：** 建立 Sidecar API 安全基线：CORS 硬化、速率限制、SSRF 防护、输入校验

**当前行为：**
CORS 全通配、无速率限制、baseUrl 完全由用户控制、输入无后端校验。

**期望行为：**
安全基线就位，所有 API 端点受速率限制和输入校验保护。

**关键接口：**
- `packages/server/src/middleware/rate-limit.ts`
- `packages/server/src/middleware/cors.ts`
- `packages/server/src/services/llm.ts` — baseUrl 白名单
- `packages/server/src/utils/validate.ts` — 输入校验

**验收标准：**
- [ ] CORS 硬化
- [ ] 速率限制中间件
- [ ] SSRF 防护（baseUrl 白名单）
- [ ] 输入校验（消息/名称/文件）
- [ ] 响应安全（不暴露内部信息）

**范围外：**
- WAF/IDS
- DDoS 防护
