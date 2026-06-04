# 前端开发指南

> GoferBot 前端（Vue 3 + Vite）开发规范与最佳实践。

---

## 规范索引

> **Agent 阅读协议**：先读本文件了解全貌，再按当前开发阶段从下方索引中选择具体规范深入。
> 新增规范文件时，只需更新本索引表格，无需修改 skill。

| 阶段 | 文档 | 必读 | 说明 |
|------|------|------|------|
| Overlay 规范 | [overlay-conventions.md](./overlay-conventions.md) | 涉及浮层时 | Dialog/ContextMenu 函数式调用规范 |
| 测试体系 | [测试体系总览](../testing/README.md) | ✅ 是 | 测试分层、命令速查、目录映射 |
| 单元测试 | [单元测试指南](../testing/unit-testing-guide.md) | ✅ 是 | 前后端单元测试完整指南（第 5-6 章为前端） |

---

## 快速参考

### 新增组件开发流程

1. 在 `packages/webui/src/components/` 创建组件
2. 在 `tests/unit/components/` 编写对应测试
3. 运行 `pnpm test` 确认通过
4. 提交代码

### 常用命令

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

### 技术栈

- **框架**：Vue 3 + TypeScript + Vite
- **状态管理**：Pinia
- **UI 组件**：shadcn-vue + Tailwind CSS v4
- **测试框架**：Vitest + @vue/test-utils + happy-dom
- **图标**：lucide-vue-next
