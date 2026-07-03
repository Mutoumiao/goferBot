# Data Schema 开发指南

> packages/data 包的 Schema 设计规范和最佳实践。

---

## 概述

`packages/data` 是纯 TypeScript Schema 包，仅包含 Zod Schema 和 TypeScript 类型定义，作为前后端共享的契约层。本目录包含该包的开发指南。

---

## 指南索引

| 指南 | 描述 | 状态 |
|------|------|------|
| [目录结构](./directory-structure.md) | Schema 包目录组织规范 | 已填写 |
| [组件指南](./component-guidelines.md) | Zod Schema 定义模式和最佳实践 | 已填写 |
| [Hook 指南](./hook-guidelines.md) | 工具函数和组合模式 | 已填写 |
| [状态管理](./state-management.md) | 配置状态、业务流程状态设计模式 | 已填写 |
| [质量指南](./quality-guidelines.md) | 代码标准和禁止模式 | 已填写 |
| [类型安全](./type-safety.md) | Zod 验证和 TypeScript 类型安全 | 已填写 |

---

## 如何使用这些指南

对于每个指南文件：

1. **记录项目的实际约定**（而非理想情况）
2. **包含代码库中的代码示例**
3. **列出禁止模式及其原因**
4. **添加团队曾犯过的常见错误**

目标是帮助 AI 助手和新团队成员理解项目的工作方式。

---

**语言**：所有文档应使用**中文**编写。
