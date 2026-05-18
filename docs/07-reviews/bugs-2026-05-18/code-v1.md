---
scope: bugs-2026-05-18
type: code
date: 2026-05-18
issues: [f-19]
status: completed
summary: 5 个 BUG 修复审查。代码+安全+行为对齐，零问题，type-check 通过。
---

# BUG 修复审查 — 2026-05-18 Bug 表

> **审查类型**：代码审查 + 安全审查 + 行为对齐
> **审查对象**：5 个文件（1 新建 + 4 修改）
> **Bug 来源**：`docs/bugs/2026-05-18-bug.md`

---

## 审查摘要

- **总体结论**：✅ 全部通过
- **问题统计**：Critical 0 | Major 0 | Minor 0 | Info 1

---

## 逐项审查

### 1. BUG类1 — folders.updated_at 列缺失

- **文件**：`packages/server/prisma/migrations/20260518000000_add_folders_updated_at/migration.sql`
- **验证**：初始 migration 创建的 `folders` 表无 `updated_at` 列，Prisma schema 已有 `@updatedAt`。
- **修复**：新增 migration，`ALTER TABLE "folders" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`
- **结果**：✅ SQL 语法正确，`IF NOT EXISTS` 保证幂等，类型与 schema 匹配（`DateTime @updatedAt`）

### 2. BUG类2 — /api/sessions POST 空 body

- **文件**：`packages/webui/src/stores/session.ts:60`
- **验证**：`api.post('/api/sessions')` 无 body → `Content-Type: application/json` 无内容 → Fastify 500。
- **修复**：`api.post<Session>('/api/sessions', {})`
- **结果**：✅ 传空对象，CreateSessionDto 所有字段均为 optional，Zod 校验通过

### 3. BUG类3 — /api/settings POST 422 校验过严

- **文件**：`packages/server/src/modules/settings/dto/settings.dto.ts`
- **验证**：`providerSchema.apiKey: z.string().min(1)` 要求所有 provider 必填 apiKey，用户仅配 custom 时 openai/claude/deepseek 空值被拒。
- **修复**：`apiKey`、`model` 改为 `z.string()`（providerSchema + embeddingProviderSchema）；`embeddingProviderSchema.provider` 同步放宽为 `z.string()`
- **结果**：✅ 允许空值，`.refine(defaultChatProvider ∈ providers keys)` 约束保留，核心校验不丢失

### 4. 交互类1 — 无鉴权调用 /api/settings

- **文件**：`packages/webui/src/App.vue:10-14`
- **验证**：`main.ts` 中 `await authStore.init()` 在 `app.mount('#app')` 之前执行，`App.vue` onMounted 时 `isAuthenticated` 已反映真实鉴权状态。但原代码无条件调 `loadConfig()`。
- **修复**：`if (authStore.isAuthenticated) { settingsStore.loadConfig() }`
- **结果**：✅ 无 token 时不发请求；SettingsPage.vue 自有 `onMounted(() => store.loadConfig())` 保证进入设置页时加载配置

### 5. 交互类2 — SettingsPage Tabs + 登出

- **文件**：`packages/webui/src/components/SettingsPage.vue`
- **验证**：auth store 有 `logout()` 但 UI 无入口。
- **修复**：Tabs 结构（模型设置 / 账户设置），账户设置 Tab 展示邮箱+昵称+登出按钮
- **结果**：✅ 全部检查通过（见下表）

---

## SettingsPage 行为对齐

| 检查项 | 状态 | 证据 |
|--------|------|------|
| Tabs 使用 reka-ui 标准组件 | ✅ | `TabsContent` v-model 绑定 |
| 默认显示模型设置 Tab | ✅ | `activeTab = ref('models')` |
| Tab 切换不触发路由变化 | ✅ | 纯组件内状态切换 |
| 账户信息展示邮箱+昵称 | ✅ | `authStore.user?.email` / `authStore.user?.name` |
| 空值回退 "—" | ✅ | `\|\| '—'` |
| 登出按钮样式（红色边框） | ✅ | `border-danger-500/30 text-danger-500` |
| 登出清除 token 并跳转登录页 | ✅ | `authStore.logout()` → `router.push({ name: 'login' })` |
| 保存按钮仅在模型设置 Tab | ✅ | 位于 `<TabsContent value="models">` 内 |
| 未保存离开拦截保留 | ✅ | `onBeforeRouteLeave` 未变 |
| data-testid 向下兼容 | ✅ | `settings-form`、`settings-save-btn` 等保留 |
| 移动端底部导航无影响 | ✅ | 仅改动内容区，导航栏在 `AppSidebar.vue` |

---

## 安全审查

| 检查项 | 状态 |
|--------|------|
| DTO 校验放宽后仍有 `.refine` 约束 | ✅ |
| 登出 API 调用失败仍清除本地 token（finally 块） | ✅ |
| 前端不存储敏感配置到非 localStorage 位置 | ✅（无新增存储） |
| 无新增依赖 | ✅ |

---

## 🔵 Info

1. **App.vue + SettingsPage.vue 双重 loadConfig** — 不修复
   - 登录后刷新页面时，`App.vue` onMounted 和 `SettingsPage.vue` onMounted 各调一次 `loadConfig()`。冗余但无害（同源数据幂等覆盖），且修复前已存在此行为。如后续优化可在 settings store 加去重。

---

## 验证

```
pnpm type-check → 全部 6 个包通过 ✅
```
