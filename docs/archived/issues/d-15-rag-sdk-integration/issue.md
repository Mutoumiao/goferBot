---
id: d-15
status: closed
track: design
priority: p2
summary: RAG SDK 集成验证（单元测试 / demo / server 集成点）
blocked_by:
  - d-12
  - d-13
  - d-14
checklist: checklist.json
plan: plan.md
specs: specs/
---

## 要构建的内容

完成 RAG SDK 的集成验证，包括单元测试补全、最小可运行 demo、以及 server 侧集成点文档。

## 规格引用

- 功能规格: specs/feature-spec.md
- API 规格: specs/api-spec.md

## 补充说明

- 依赖 d-12（indexing）、d-13（runtime）、d-14（observability）全部完成后方可开始
- 本 issue 不修改 server 代码，仅输出集成点文档（哪些接口需要 server 实现、如何注入）
- demo 需展示最小闭环：DocumentSource → chunk → embed → index → Query → retrieve → postprocess → context
- 单元测试覆盖率目标：核心逻辑 ≥ 80%
