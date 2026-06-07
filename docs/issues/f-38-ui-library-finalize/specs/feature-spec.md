# 功能规格：UI 组件库收尾与样式对齐

> 状态：draft | 关联 issue：f-38 | PRD：§5.4 + §6.6

---

## 1. 目标

批量替换剩余 shadcn-vue 组件为 shadcn/ui React 版，对齐样式（处理 `:deep()` 残留），验证 Tailwind 主题变量与 Pencil tokens 一致，补全 packages/data/ 剩余业务域 schema。

---

## 2. 功能描述

### 2.1 shadcn/ui 组件替换

1. 扫描 `packages/web/app/components/ui/` 目录，列出所有已使用的 shadcn 组件
2. 对比现有 `packages/webui/src/components/ui/` Vue 版本
3. 用 `npx shadcn@latest add <component>` 安装缺失的 React 版组件
4. 替换所有 import 路径（`@/components/ui/button` 等）

### 2.2 `:deep()` 样式穿透迁移

- Vue `:deep()` → React 对应方案：
  - `:deep(.child) { ... }` → `[&_.child]:text-red` (Tailwind arbitrary selector)
  - 或使用 CSS Modules / `styles.module.css`

### 2.3 Tailwind 主题对齐

- 确认 `globals.css` 中所有 Pencil tokens CSS 变量与 `packages/webui/src/styles/` 一致
- 确保所有组件使用 token 变量而非硬编码颜色

### 2.4 packages/data/ schema 补全

- 确认 auth、kb、chat、common 四个域的 schema 已全部提取
- `types/index.ts` 统一导出所有类型

---

## 3. 验收标准

| AC | 验收项 |
|----|--------|
| AC-01 | 所有 shadcn-vue 组件已替换 |
| AC-02 | `:deep()` 无残留 |
| AC-03 | Tailwind 变量与 Pencil tokens 对齐 |
| AC-04 | packages/data/ 所有业务域 schema 完整 |
| AC-05 | types/index.ts 统一导出 |
| AC-06 | 主要页面视觉走查无异常 |
