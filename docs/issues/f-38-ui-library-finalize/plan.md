---
id: f-38
issue: issue.md
version: 1
---

# UI 组件库收尾与样式对齐 实现计划

**目标：** 批量替换 shadcn 组件 + 样式对齐 + schema 补全

**PRD 引用：** §5.4 + §6.6

---

## ADR 合规声明

| ADR | 涉及内容 | 符合 |
|-----|---------|------|
| ADR 0001 | 依赖引入 | ✅ shadcn/ui 为批准的技术栈 |

---

## 任务列表

### 任务 1: shadcn/ui 组件批量替换
- [ ] RED → GREEN：扫描缺失组件 → `npx shadcn@latest add` → 更新 import → `pnpm build`

### 任务 2: `:deep()` 残留清理
- [ ] RED → GREEN：`rg ':deep\('` 扫描 → 逐个替换为 Tailwind arbitrary selector → 验证无残留

### 任务 3: Tailwind 主题对齐验证
- [ ] 确认 Pencil tokens 一致 → 视觉走查

### 任务 4: packages/data/ schema 补全
- [ ] 确认 auth/kb/chat/common 四个域完整 → `pnpm type-check`
