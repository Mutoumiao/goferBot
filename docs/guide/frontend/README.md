# 前端开发指南

> GoferBot 前端（Vue 3 + Vite）开发规范与最佳实践。

---

## 目录

| 文档 | 内容 |
|------|------|
| [unit-testing-guide.md](./unit-testing-guide.md) | 前端单元测试完整指南 |

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
