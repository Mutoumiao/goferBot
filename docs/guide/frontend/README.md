# 前端开发指南

> GoferBot 前端开发规范与最佳实践。
>
> 本项目包含多个前端应用，请根据当前开发的项目选择对应规范。

---

## 项目结构

| 目录 | 技术栈 | 状态 | 适用场景 |
|------|--------|------|----------|
| `packages/webui/` | Vue 3 + Vite + Pinia + shadcn-vue | 维护中，逐步迁移 | 现有功能维护 |
| `apps/web/` | TanStack Start + React + Zustand + shadcn/ui | 新开发（推荐） | 新功能开发 |
| `apps/admin/` | React + Ant Design Pro | 未来建设 | 后台管理端 |

---

## 规范索引

### React 项目（apps/web）参考文档

> 迁移期间新创建的参考文档，覆盖 TanStack Start、shadcn/ui、Zustand 等。

| 阶段 | 文档 | 必读 | 说明 |
|------|------|------|------|
| 框架入门 | [TanStack Start 参考](../../reference/tanstack-start-guide.md) | ✅ 是 | 路由、服务端函数、部署配置 |
| 代码迁移 | [Vue → React 对照](../../reference/vue-to-react-patterns.md) | ✅ 是 | 常用 Vue 模式转 React |
| UI 组件 | [shadcn/ui 参考](../../reference/shadcn-ui-patterns.md) | 涉及 UI 时 | 组件使用与定制 |
| 状态管理 | [Zustand 参考](../../reference/zustand-patterns.md) | 涉及状态时 | Store 定义、持久化、与 Query 配合 |
| 迁移计划 | [迁移 PRD](../../prd/v3-frontend-migration.md) | 了解全貌 | 架构决策、迁移范围、阶段计划 |
| 检查清单 | [迁移检查清单](../../reference/migration-checklist.md) | 迁移时 | 逐项验证迁移质量 |

### Vue 项目（packages/webui）参考文档

| 阶段 | 文档 | 必读 | 说明 |
|------|------|------|------|
| Overlay 规范 | [overlay-conventions.md](./overlay-conventions.md) | 涉及浮层时 | Dialog/ContextMenu 函数式调用规范 |
| Mock 数据 | [mock-conventions.md](./mock-conventions.md) | 使用 Mock 时 | Mock 生命周期、清理规则 |
| 测试体系 | [测试体系总览](../testing/README.md) | ✅ 是 | 测试分层、命令速查、目录映射 |
| 单元测试 | [单元测试指南](../testing/unit-testing-guide.md) | ✅ 是 | 前后端单元测试完整指南（第 5-6 章为前端） |

---

## 快速参考

### React 项目（apps/web）

#### 新增组件开发流程

1. 在 `apps/web/app/components/` 创建组件
2. 在 `tests/unit/web/` 编写对应测试
3. 运行 `pnpm test` 确认通过
4. 提交代码

#### 常用命令

```bash
# 运行全部前端单元测试
pnpm test

# 监视模式开发
pnpm vitest

# UI 模式
pnpm vitest --ui

# 类型检查
pnpm type-check

# 启动前端开发服务器
pnpm dev:web
```

#### 技术栈

- **框架**：TanStack Start + React + TypeScript + Vite
- **状态管理**：Zustand（客户端状态）+ TanStack Query（服务端状态）
- **UI 组件**：shadcn/ui + Tailwind CSS v4
- **测试框架**：Vitest + React Testing Library + happy-dom
- **图标**：lucide-react

---

### Vue 项目（packages/webui）

#### 新增组件开发流程

1. 在 `packages/webui/src/components/` 创建组件
2. 在 `tests/unit/components/` 编写对应测试
3. 运行 `pnpm test` 确认通过
4. 提交代码

#### 常用命令

```bash
# 运行全部前端单元测试
pnpm test

# 监视模式开发
pnpm vitest

# UI 模式
pnpm vitest --ui

# 类型检查
pnpm type-check

# 启动前端开发服务器
pnpm dev:web
```

#### 技术栈

- **框架**：Vue 3 + TypeScript + Vite
- **状态管理**：Pinia
- **UI 组件**：shadcn-vue + Tailwind CSS v4
- **测试框架**：Vitest + @vue/test-utils + happy-dom
- **图标**：lucide-vue-next

---

## 迁移说明

当前正在进行 Vue → React 迁移，详见 [迁移 PRD](../../prd/v3-frontend-migration.md)。

- **新功能**请在 `apps/web/` 中开发（React）
- **Bug 修复**可在 `packages/webui/` 中继续（Vue），后续同步迁移
- **共享代码**（类型、工具函数）优先放在 `apps/web/` 中，Vue 端引用时注意兼容性
