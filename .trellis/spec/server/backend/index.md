# 后端开发指南

> 本项目后端开发的最佳实践。

---

## 概述

本目录包含后端开发指南。请在每个文件中填写项目特定的约定。

---

## 指南索引

| 指南 | 描述 | 状态 |
|------|------|------|
| [目录结构](./directory-structure.md) | 模块组织和文件布局 | 已填写 |
| [数据库指南](./database-guidelines.md) | ORM 模式、查询、迁移 | 已填写 |
| [错误处理](./error-handling.md) | 错误类型、处理策略 | 已填写 |
| [质量指南](./quality-guidelines.md) | 代码标准、禁止模式 | 已填写 |
| [日志指南](./logging-guidelines.md) | 结构化日志、日志级别 | 已填写 |
| [伴侣管线](./companion-pipeline.md) | LangGraph 路由规则、策略包、提示链 | 已填写 |
| [RAG 实现](./rag-implementation.md) | ES 过滤器、BGE 重排序器配置、处理器架构 | 已填写 |
| [队列实现](./queue-implementation.md) | BullMQ 三队列架构、索引 Worker 管线、Redis 生命周期 | 已填写 |
| [解析器实现](./parser-implementation.md) | 策略模式、PDF 三重后备、StructureExtractor | 已填写 |

---

## 如何填写这些指南

对于每个指南文件：

1. 记录项目的**实际约定**（而非理想情况）
2. 包含代码库中的**代码示例**
3. 列出**禁止模式**及其原因
4. 添加团队曾犯过的**常见错误**

目标是帮助 AI 助手和新团队成员理解项目的工作方式。

---

**语言**：所有文档应使用**中文**编写。
