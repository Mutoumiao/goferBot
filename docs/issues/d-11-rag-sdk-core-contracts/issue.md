---
id: d-11
status: open
track: design
priority: p1
summary: RAG SDK Core 契约层（types / schema / interfaces / errors / pipeline / vector-store）
blocked_by: []
checklist: checklist.json
plan: plan.md
specs: specs/
---

## 要构建的内容

实现 RAG SDK 的共享领域契约层，包含所有跨模块依赖的数据模型、Zod Schema、能力接口、错误体系、Pipeline 抽象和向量存储接口。

## 规格引用

- 功能规格: specs/feature-spec.md
- API 规格: specs/api-spec.md

## 补充说明

- 这是 RAG SDK 的阻塞性基础 issue，d-12/d-13/d-14 均依赖此 issue 完成后才能编译
- Core 采用扁平化设计，所有契约文件直接放在 `src/` 根目录，不设 `core/` 子目录
- 向量存储接口 `IVectorStore` 从此 issue 开始内聚到 SDK，彻底解耦对 server 的反向依赖
- 所有类型必须由 Zod Schema 推导（`z.infer`），禁止手写重复类型
