# 前端 Mock 规范

> 与 `docs/guide/workflow.md` 中的"联调整合"章节配套使用。
>
> ⚠️ **适用范围**：本文档以 `packages/webui/`（Vue）为例，目录结构原则同样适用于 `apps/web/`（React）。

---

## 目录结构

### Vue 项目（packages/webui）

```
packages/webui/src/mocks/
├── handlers/           # Mock handler（MSW / 自定义）
│   └── {feature}.ts    # 按功能模块组织
├── data/               # Mock 数据（纯 JSON，无逻辑）
│   └── {feature}.json
└── index.ts            # 统一导出，含启用开关
```

---

## Mock 使用规则

### 1. Mock 必须基于已批准的 api-spec

- Mock 的响应结构必须与 `docs/issues/b-XX/specs/api-spec.md` 一致
- api-spec 变更时，Mock 必须同步更新
- **禁止**在 Mock 中发明 api-spec 未定义的字段

### 2. Mock 必须标记生命周期

每个 Mock handler 文件顶部必须包含 `MOCK-LIFECYCLE` 标记：

```typescript
// packages/webui/src/mocks/handlers/session.ts
// MOCK-LIFECYCLE: b-14 完成后移除
// api-spec: docs/issues/b-14-admin-user-management/specs/api-spec.md
// 关联 issue: f-XX-session-list-pagination
```

标记格式：
```
// MOCK-LIFECYCLE: {后端 issue 编号} 完成后移除
// api-spec: {api-spec 文件路径}
// 关联 issue: {前端 issue 编号}
```

### 3. 禁止硬编码 Mock 数据在组件/Store 中

❌ **错误**：
```typescript
// stores/session.ts
const MOCK_SESSIONS = [
  { id: '1', title: 'Mock Session' }
]
```

✅ **正确**：
```typescript
// stores/session.ts
import { mockSessionData } from '@/mocks/data/session'

// 仅在开发环境且后端未完成时使用
```

### 4. 验收时必须清理

- `/integration-check` 扫描 `MOCK-LIFECYCLE:` 标记
- 标记的后端 issue 已关闭 → 标记为 Critical，必须移除
- 关闭 issue 前必须确认无 Mock 残留

---

## Mock 启用策略

### 开发阶段（后端未完成）

#### Vue 项目

```typescript
// packages/webui/src/mocks/index.ts
import { sessionHandlers } from './handlers/session'

export const mockEnabled = import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === 'true'

export const handlers = [
  ...sessionHandlers,
  // ...其他 handler
]
```

#### React 项目

```typescript
// apps/web/app/mocks/index.ts
import { sessionHandlers } from './handlers/session'

export const mockEnabled = import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === 'true'

export const handlers = [
  ...sessionHandlers,
  // ...其他 handler
]
```

环境变量 `.env.development`：
```
VITE_USE_MOCK=true
```

### 联调阶段（后端已完成）

1. 设置 `VITE_USE_MOCK=false`
2. 验证前端调用真实 API
3. 运行 `/integration-check` 确认无 Mock 残留
4. 删除对应 Mock handler 和数据文件

---

## 与 integration-check 的集成

`integration-check` 扫描以下内容：

| 扫描目标 | 模式 | 处理方式 |
|---------|------|---------|
| `MOCK-LIFECYCLE:` 标记 | 正则匹配 `// MOCK-LIFECYCLE:.*完成后移除` | 提取关联 issue 编号，检查是否已关闭 |
| `TODO: 联调` | 正则匹配 `TODO.*联调\|TODO.*替换为真实 API` | 标记为 Major，需清理 |
| `const MOCK_` | 正则匹配 `const MOCK_\w+` | 标记为 Critical，需移除 |
| `mockApiCall` | 正则匹配 `mockApiCall\|mockFetch\|mockData` | 标记为 Critical，需移除 |

---

## 示例：Session 分页 Mock

### Mock 数据

```json
// packages/webui/src/mocks/data/session.json
{
  "sessions": [
    { "id": "1", "title": "首页", "messageCount": 5, "updatedAt": "2026-06-01T10:00:00Z" }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

### Mock Handler

```typescript
// packages/webui/src/mocks/handlers/session.ts
// MOCK-LIFECYCLE: b-14 完成后移除
// api-spec: docs/issues/b-14-admin-user-management/specs/api-spec.md
// 关联 issue: f-XX-session-list-pagination

import { http, HttpResponse } from 'msw'
import sessionData from '../data/session.json'

export const sessionHandlers = [
  http.get('/api/sessions', ({ request }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page')) || 1
    const limit = Number(url.searchParams.get('limit')) || 20

    // 基于 api-spec 的响应结构
    return HttpResponse.json({
      data: {
        items: sessionData.sessions,
        pagination: {
          ...sessionData.pagination,
          page,
          limit
        }
      }
    })
  })
]
```

---

## 自检清单

- [ ] Mock 数据结构与 api-spec 一致？
- [ ] 每个 Mock handler 都有 `MOCK-LIFECYCLE:` 标记？
- [ ] Mock 数据放在 `mocks/data/` 而非组件/Store 中？
- [ ] 后端 issue 关闭后已移除对应 Mock？
- [ ] `/integration-check` 扫描无 Mock 残留？
