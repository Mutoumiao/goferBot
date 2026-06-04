---
name: integration-check
description: >
  联调对接检查器。比对前端 API 调用与后端 api-spec，检测端点缺失、参数不匹配、
  响应格式差异、Mock 残留等问题。
  当用户说"联调"、"前后端对接"、"检查接口对齐"、"Mock 可以删了吗"、
  "前端调用对吗"、"对接检查"时触发。
  应在前后端配对 issue 的后端完成后、关闭 issue 前自动调用。
---

# 联调对接检查器

## 执行摘要

| 项目 | 内容 |
|------|------|
| **触发词** | "联调"、"前后端对接"、"检查接口对齐"、"Mock 可以删了吗" |
| **硬关卡** | 发现接口不匹配或 Mock 残留时，禁止关闭 issue |
| **核心输出** | 对接问题列表 + 前后端一致性报告 |
| **禁止行为** | 前后端未真实联调就标记 issue 完成 |
| **下一步** | 修复对接问题 → 重新检查 → 通过后方可关闭 |

**核心理念**：前后端配对（f-XX + b-XX）是常态，联调是关闭前的必经关卡。Mock 是开发期的拐杖，不是交付物。

**开始时声明：** "正在使用 integration-check skill 执行前后端联调对接检查。"

---

## 检查时机

| 场景 | 调用方 | 检查目标 |
|------|--------|----------|
| 后端 b-XX 完成后 | dev-orchestrator / 用户 | 检查前端 f-XX 是否可移除 Mock |
| 关闭 issue 前 | kb-review / issue-lifecycle | 验证前后端已完成真实 API 对接 |
| 用户主动要求 | 直接调用 | 指定前后端文件进行比对 |
| 发现接口异常 | 运行时 | 排查前后端不一致问题 |

---

## 检查维度

### 维度 1：端点存在性

**检查内容：** 前端调用的每个 API 端点，在后端是否都有实现？

**扫描前端代码：**

```typescript
// 扫描目标：packages/webui/src/ 下的 API 调用
// 模式：fetch、axios、useFetch、apiClient 等

// 示例调用点
const response = await apiClient.get('/api/sessions', { params: { page, limit } })
const response = await apiClient.patch(`/api/admin/users/${id}/status`, { isActive })
```

**比对后端 api-spec：**

```markdown
api-spec.md 中声明的端点：
- GET /api/sessions
- GET /admin/users
- PATCH /admin/users/:id/status
```

**问题输出格式：**

```markdown
### 端点存在性检查

| 前端调用 | 后端实现 | 状态 |
|----------|----------|------|
| GET /api/sessions | ✅ api-spec.md | 匹配 |
| GET /admin/users | ✅ api-spec.md | 匹配 |
| PATCH /api/admin/users/:id/status | ✅ api-spec.md | 匹配 |
| POST /api/sessions/:id/clone | ❌ 未找到 | 🔴 缺失 |
```

---

### 维度 2：请求参数一致性

**检查内容：** 前端发送的参数名、类型、必填性是否与后端 api-spec 一致？

**比对项：**

| 检查项 | 前端 | 后端 | 状态 |
|--------|------|------|------|
| 参数名 | `page` | `page` | ✅ 匹配 |
| 参数名 | `limit` | `size` | ❌ 不匹配 |
| 参数类型 | `page: number` | `z.coerce.number()` | ✅ 兼容 |
| 必填性 | 总是发送 `search` | `search?: string` | ✅ 兼容 |
| 布尔值格式 | `isActive: true` | `z.union([...]).transform(...)` | 需验证 |

**问题输出格式：**

```markdown
### 请求参数一致性检查

#### GET /admin/users

| 参数 | 前端发送 | 后端期望 | 状态 | 说明 |
|------|----------|----------|------|------|
| page | ✅ number | ✅ `z.coerce.number()` | 匹配 | |
| size | ❌ `limit` | ✅ `size` | 🔴 不匹配 | 前端用 `limit`，后端用 `size` |
| search | ✅ string | ✅ `z.string().optional()` | 匹配 | |
| isActive | ✅ boolean | ✅ `z.union` + transform | 匹配 | URL 参数需传 `"true"`/`"false"` |

**建议**：统一前端参数名为 `size`，与后端 DTO 一致。
```

---

### 维度 3：响应格式一致性

**检查内容：** 后端返回的数据结构是否与前端的消费代码匹配？

**比对项：**

| 检查项 | 后端返回 | 前端消费 | 状态 |
|--------|----------|----------|------|
| 包装层级 | `{ data: { items, pagination } }` | `response.data.items` | 需确认 |
| 字段名 | `items` | `items` | ✅ 匹配 |
| 字段名 | `pagination.total` | `pagination.total` | ✅ 匹配 |
| 字段缺失 | 后端返回 `role` | 前端未使用 | 🟡 可选 |
| 字段缺失 | 后端未返回 `avatar` | 前端期望 | 🔴 问题 |

**注意 ResponseInterceptor 的影响：**

```
后端 Controller: return { items, pagination }
ResponseInterceptor: → { data: { items, pagination } }
前端接收: response.data → { items, pagination }
```

**问题输出格式：**

```markdown
### 响应格式一致性检查

#### GET /api/sessions

| 字段 | 后端返回 | 前端消费 | 状态 |
|------|----------|----------|------|
| items | ✅ Array | ✅ `response.data.items` | 匹配 |
| items[].id | ✅ string | ✅ `item.id` | 匹配 |
| items[].messageCount | ✅ number | ✅ `item.messageCount` | 匹配 |
| pagination | ✅ object | ✅ `response.data.pagination` | 匹配 |
| pagination.total | ✅ number | ✅ `pagination.total` | 匹配 |

**注意**：前端需访问 `response.data.items`（经 ResponseInterceptor 包装），
而非直接 `response.items`。
```

---

### 维度 4：Mock 残留检查

**检查内容：** 前端代码中是否还有未移除的 Mock 数据？

**扫描模式：**

```typescript
// 扫描目标
const MOCK_DATA = [...]                    // 🔴 Mock 常量
const mockSessions = [...]                 // 🔴 Mock 数据

// TODO: 联调                              // 🟡 联调标记
// TODO: 替换为真实 API                     // 🟡 替换标记

// Mock 函数
function mockApiCall() { ... }             // 🔴 Mock 函数

// 条件 Mock
if (process.env.NODE_ENV === 'development') {
  return mockData                          // 🟠 环境条件 Mock
}
```

**问题输出格式：**

```markdown
### Mock 残留检查

| 位置 | 类型 | 状态 | 说明 |
|------|------|------|------|
| `packages/webui/src/stores/session.ts:23` | `const MOCK_SESSIONS` | 🔴 需移除 | 替换为真实 API 调用 |
| `packages/webui/src/views/ChatView.vue:45` | `// TODO: 联调` | 🟡 需清理 | 后端已完成，移除标记 |
| `packages/webui/src/api/client.ts:12` | `mockApiCall()` | 🔴 需移除 | 使用 `apiClient.get()` 替代 |

**建议移除顺序：**
1. 替换 Mock 函数为真实 API 调用
2. 删除 Mock 常量/数据
3. 清理 TODO: 联调 标记
4. 运行前端测试验证
```

---

### 维度 5：错误处理一致性

**检查内容：** 前端错误处理是否覆盖了后端 api-spec 中声明的所有错误码？

| 后端错误码 | 场景 | 前端处理 | 状态 |
|-----------|------|----------|------|
| 400 | 参数校验失败 | ✅ 显示表单错误 | 匹配 |
| 401 | 未认证 | ✅ 跳转登录页 | 匹配 |
| 403 | 无权限 | ❌ 未处理 | 🔴 缺失 |
| 404 | 资源不存在 | ✅ 显示 404 页面 | 匹配 |
| 500 | 服务器错误 | ✅ 显示通用错误 | 匹配 |

---

## 执行流程

### 步骤 1：确定检查范围

**方式 A：用户显式提供前后端 issue 目录**

```
输入：f-XX issue 目录 + 对应的 b-XX issue 目录
    ↓
读取前端代码：packages/webui/src/ 下相关文件
读取后端契约：docs/issues/b-XX/specs/api-spec.md
读取后端实现：packages/server/src/ 下相关 Controller/Service
```

**方式 B：自动发现配对 issue**

```
输入：单个 issue 目录（f-XX 或 b-XX）
    ↓
提取 issue 前缀和数字（如 b-14 → 14）
    ↓
在 docs/issues/ 下查找配对：
  - 输入 b-14 → 查找 f-14-* 或 f-14（如存在 f-14-admin-user-management）
  - 输入 f-16 → 查找 b-16-* 或 b-16（如存在 b-16-chat-kb-selector）
    ↓
找到配对 → 继续正常检查流程
未找到配对 → 输出"未找到配对 issue，跳过联调检查"
```

**配对规则：**

| 输入 | 查找目标 | 示例 |
|------|---------|------|
| `b-14-admin-user-management` | `f-14-*` | `f-14-admin-user-management` |
| `f-16-chat-kb-selector` | `b-16-*` | `b-16-chat-kb-selector` |
| `b-09-chat-rag-retrieval` | `f-09-*` 或 `f-16-*` | 按功能名匹配（如 chat） |

**注意**：当按数字未找到配对时，可尝试按功能关键词（如 chat、session、user）模糊匹配，但需用户确认。

### 步骤 2：提取前端 API 调用点

```bash
# 扫描前端代码中的 API 调用
cd packages/webui/src
grep -rn "apiClient\|fetch\|axios\|useFetch" --include="*.ts" --include="*.vue"
```

### 步骤 3：提取后端端点定义

```bash
# 扫描后端 Controller 中的路由装饰器
cd packages/server/src
grep -rn "@Get\|@Post\|@Patch\|@Delete" --include="*.ts"
```

### 步骤 4：执行五维度比对

```
维度 1：端点存在性 — 前端调用 vs 后端实现
维度 2：请求参数 — 前端发送 vs 后端 DTO
维度 3：响应格式 — 后端返回 vs 前端消费
维度 4：Mock 残留 — 扫描 TODO/MOCK 标记
维度 5：错误处理 — 后端错误码 vs 前端处理
```

### 步骤 5：生成分级报告

```markdown
## 联调对接检查报告

- **前端 Issue**：f-16-chat-kb-selector
- **后端 Issue**：b-09-chat-rag-retrieval
- **检查时间**：2026-06-04
- **总体结论**：⚠️ 有条件通过（存在 Major 问题）

### 🔴 Critical（阻塞关闭）

1. **Mock 未移除**
   - 位置：`stores/session.ts:23`
   - 问题：`MOCK_SESSIONS` 仍在使用
   - 修复：替换为 `apiClient.get('/api/sessions')`

### 🟠 Major（建议修复）

1. **参数名不一致**
   - 前端用 `limit`，后端用 `size`
   - 建议统一为 `size`

### 🟡 Minor（可选修复）

（无）

### ✅ 已通过检查项

- 端点存在性：全部匹配
- 响应格式：一致
- 错误处理：401/404/500 已覆盖

---

## 修复后操作

修复所有 Critical 问题后，重新运行本 skill 扫描。
扫描通过后方可关闭前后端 issue。
```

---

## 与现有 Skill 的集成

### dev-orchestrator 集成

后端 b-XX 完成后，dev-orchestrator 自动触发 integration-check：

```
后端 b-XX 开发完成
    ↓
dev-orchestrator 检查前端 f-XX 状态
    ↓
前端是否使用 Mock？
    ↓ 是
integration-check 执行对接检查
    ↓
输出 Mock 替换清单
    ↓
前端移除 Mock，对接真实 API
    ↓
integration-check 重新验证
    ↓
✅ 通过 → 进入联调测试
```

### kb-review 集成

关闭前验收时，kb-review 调用 integration-check：

```
kb-review 关闭前验收
    ↓
integration-check 扫描前后端对接状态
    ↓
❌ 发现 Mock 残留 → 标记 Critical，禁止关闭
✅ 无问题 → kb-review 继续其他检查
```

### issue-lifecycle 集成

issue-lifecycle 关闭 issue 前：

```
issue-lifecycle 尝试关闭 f-XX / b-XX
    ↓
检查是否有配对 issue
    ↓ 有
integration-check 验证联调完成
    ↓
❌ 未完成 → 提示先完成联调
✅ 已完成 → 允许关闭
```

---

## 常见陷阱

| 陷阱 | 后果 | 正确做法 |
|------|------|----------|
| 只检查端点存在不检查参数 | 前端传 `limit` 后端收 `size`，运行时 400 | 逐参数比对名称和类型 |
| 忽略 ResponseInterceptor 包装 | 前端直接取 `response.items` 实际在 `response.data.items` | 确认响应层级 |
| 只检查 API 调用不检查 Mock | 关闭后才发现页面仍显示假数据 | 扫描所有 TODO/MOCK 标记 |
| 只检查 happy path 错误码 | 线上出现 403 时前端崩溃 | 对照 api-spec 错误码表格逐项检查 |
| 后端改接口不通知前端 | 联调时才发现契约已变 | 接口变更必须同步更新 api-spec 并触发重新检查 |

---

## 自检清单

检查完成后自查：

- [ ] 前端所有 API 调用点都有对应后端端点？
- [ ] 请求参数名称、类型前后端一致？
- [ ] 响应格式（含 ResponseInterceptor 包装）前端正确消费？
- [ ] 无 Mock 数据/函数/TODO 标记残留？
- [ ] 后端所有错误码前端都有处理？
- [ ] 联调测试（端到端）是否通过？

---

*本文档与 `docs/guide/workflow.md` 中的"联调整合"章节配套使用。*
