---
id: f-37
issue: issue.md
version: 1
---

# 辅助页面迁移 实现计划

**目标：** 迁移 History/Settings/RecycleBin + 4 个 Zustand Stores + Sidebar 业务逻辑

**技术栈：** alova + Zustand + TanStack Router

**PRD 引用：** §5.3 P1-P2 + §6.5

---

## ADR 合规声明

| ADR | 涉及内容 | 符合 |
|-----|---------|------|
| ADR 0001 | 依赖引入 | ✅ 无新增禁止依赖 |

---

## 任务列表

### 任务 1: 创建 Zustand Stores（session/settings/tabs/file）
- [ ] RED → GREEN：4 个 Store 的单元测试（create/set/clear）

### 任务 2: Sidebar 业务逻辑（会话列表 + Tab 联动）
- [ ] RED → GREEN：Sidebar 渲染会话列表，分页，高亮当前

### 任务 3: HistoryPage
- [ ] RED → GREEN：会话列表 + 搜索/筛选 + 点击跳转

### 任务 4: SettingsPage
- [ ] RED → GREEN：配置表单 + 未保存提示 + 保存反馈

### 任务 5: RecycleBinPage + common schema
- [ ] RED → GREEN：回收站列表 + 恢复/永久删除 + `packages/data/src/schemas/common.schema.ts`
