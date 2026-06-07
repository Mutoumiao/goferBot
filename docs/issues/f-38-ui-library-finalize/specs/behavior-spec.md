# 行为规格：UI 组件库收尾与样式对齐

> 状态：draft | 关联 issue：f-38

---

## 1. 验证行为

| 检查项 | 验证方式 |
|--------|----------|
| shadcn 组件完整 | `ls packages/web/app/components/ui/` 列出所有组件，确认无缺失 |
| `:deep()` 残留 | `rg ':deep\(' packages/web --include='*.tsx' --include='*.css'` 无结果 |
| Tailwind 变量 | 人工对比 `globals.css` 与 `packages/webui/src/styles/` |
| schema 完整 | `ls packages/data/src/schemas/` 包含 auth/kb/chat/common |
| 视觉走查 | 手动访问 /login、/app/chat、/app/kb、/app/settings |

## 2. 测试映射

| AC | 验证方式 |
|----|----------|
| AC-01 | bash 脚本检查 + `pnpm build` 无导入错误 |
| AC-02 | grep 扫描 + `pnpm type-check` |
| AC-03 ~ AC-06 | 手动验证 |
