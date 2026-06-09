# 前端开发指南

> GoferBot 前端开发规范与最佳实践。
>
> 本项目包含多个前端应用，请根据当前开发的项目选择对应规范。

---

## 项目结构

| 目录 | 技术栈 | 状态 | 适用场景 |
|------|--------|------|----------|
| `packages/web/` | TanStack Start + React + Zustand + shadcn/ui | **主前端（活跃开发）** | 所有新功能开发 |
| `packages/admin/` | React + Ant Design Pro | 未来建设 | 后台管理端 |
| `packages/webui/` | Vue 3 + Vite + Pinia + shadcn-vue | **已冻结，待删除（f-39）** | 仅保留参考，不接收修改 |

> **重要**：所有新功能必须在 `packages/web/` 中开发。`packages/webui/` 已冻结，不接收任何修改。

---

## 规范索引

### React 项目（packages/web）参考文档

> 迁移期间新创建的参考文档，覆盖 TanStack Start、shadcn/ui、Zustand 等。

| 阶段 | 文档 | 必读 | 说明 |
|------|------|------|------|
| 框架入门 | [TanStack Start 参考](../../reference/tanstack-start-guide.md) | ✅ 是 | 路由、服务端函数、部署配置 |
| 代码迁移 | [Vue → React 对照](../../reference/vue-to-react-patterns.md) | ✅ 是 | 常用 Vue 模式转 React |
| UI 组件 | [shadcn/ui 参考](../../reference/shadcn-ui-patterns.md) | 涉及 UI 时 | 组件使用与定制 |
| 状态管理 | [Zustand 参考](../../reference/zustand-patterns.md) | 涉及状态时 | Store 定义、持久化、与 Query 配合 |
| 迁移计划 | [迁移 PRD](../../prd/v3-frontend-migration.md) | 了解全貌 | 架构决策、迁移范围、阶段计划 |
| 检查清单 | [迁移检查清单](../../reference/migration-checklist.md) | 迁移时 | 逐项验证迁移质量 |

### React 项目（packages/web）参考文档

| 阶段 | 文档 | 必读 | 说明 |
|------|------|------|------|
| 框架入门 | [TanStack Start 参考](../../reference/tanstack-start-guide.md) | ✅ 是 | 路由、服务端函数、部署配置 |
| UI 组件 | [shadcn/ui 参考](../../reference/shadcn-ui-patterns.md) | 涉及 UI 时 | 组件使用与定制 |
| 状态管理 | [Zustand 参考](../../reference/zustand-patterns.md) | 涉及状态时 | Store 定义、持久化、与 Query 配合 |
| 迁移计划 | [迁移 PRD](../../prd/v3-frontend-migration.md) | 了解全貌 | 架构决策、迁移范围、阶段计划 |
| 检查清单 | [迁移检查清单](../../reference/migration-checklist.md) | 迁移时 | 逐项验证迁移质量 |

---

## 快速参考

### React 项目（packages/web）

#### 新增组件开发流程

1. 在 `packages/web/src/components/` 创建组件
2. 在 `packages/web/tests/` 编写对应测试
3. 运行 `pnpm test` 确认通过
4. 提交代码

#### 常用命令

```bash
# 运行前端单元测试（packages/web）
cd packages/web && pnpm test

# 监视模式开发
cd packages/web && pnpm vitest

# 类型检查
cd packages/web && pnpm type-check

# 启动前端开发服务器
pnpm dev:web
```

#### 技术栈

- **框架**：TanStack Start + React 19 + TypeScript + Vite 8
- **状态管理**：Zustand 5（persist / plain 两种模式）
- **UI 组件**：shadcn/ui + Tailwind CSS v4
- **测试框架**：Vitest 4 + @testing-library/react + happy-dom
- **图标**：lucide-react
- **HTTP**：alova 3（禁止原生 fetch）
