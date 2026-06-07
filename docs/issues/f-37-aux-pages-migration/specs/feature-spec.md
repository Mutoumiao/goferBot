# 功能规格：辅助页面迁移

> 状态：draft | 关联 issue：f-37 | PRD：§5.3 P1-P2 + §6.5

---

## 1. 目标

迁移 History/Settings/RecycleBin 辅助页面 + 剩余 4 个 Zustand Stores + Sidebar 业务逻辑 + packages/data/ common schema。

---

## 2. 功能描述

### 2.1 HistoryPage

| 功能 | 实现 |
|------|------|
| 会话历史列表 | `useRequest` GET /sessions?page=&limit= |
| 搜索/筛选 | `useWatcher` 监听搜索关键词变化 |
| 点击会话 | 跳转 `/app/chat/$sessionId` |

### 2.2 SettingsPage

| 功能 | 实现 |
|------|------|
| 配置表单 | `useForm` + PUT /settings |
| 未保存提示 | `useBlocker` 或自定义 hook 拦截路由离开 |
| 保存确认 | Toast 提示"已保存" |

### 2.3 RecycleBinPage

| 功能 | 实现 |
|------|------|
| 已删除文档列表 | `useRequest` GET /kb/recycle |
| 恢复 | POST /kb/$id/restore → 列表刷新 |
| 永久删除 | DELETE /kb/$id/permanent → 列表刷新 |

### 2.4 Zustand Stores

| Store | 状态 | 持久化 |
|-------|------|--------|
| session | `sessions[]`, `currentSessionId` | localStorage |
| settings | `theme`, `language`, `model` 等 | localStorage |
| tabs | `tabs[]`, `activeTabId` | localStorage |
| file | `uploads[]`, `uploadProgress` | 不持久化 |

### 2.5 Sidebar 业务逻辑

- 会话列表加载（分页）
- 当前会话高亮
- Tab 切换联动
- 各 Store 连接

### 2.6 packages/data/ common schema

```typescript
export const paginationSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100).default(20),
})

export const apiResponseSchema = z.object({
  data: z.unknown(),
})
```

---

## 3. 验收标准

| AC | 验收项 |
|----|--------|
| AC-01 | HistoryPage 会话列表 + 搜索/筛选 |
| AC-02 | SettingsPage 配置表单 + 未保存提示 |
| AC-03 | RecycleBinPage 删除列表 + 恢复/永久删除 |
| AC-04 | Sidebar 会话列表（分页）+ 高亮 + Tab 联动 |
| AC-05 | 4 个 Zustand Stores 完成 |
| AC-06 | packages/data common.schema.ts |
| AC-07 | 所有页面三态完整 |
